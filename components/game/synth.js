/*
  synth.js — every game sound is synthesized WebAudio. No audio files,
  no network, autoplay-safe (the context is created on the Press Start
  gesture). One master gain for the mute toggle; bgm is a tiny 8-step
  chiptune sequencer kept far below the SFX in the mix.
*/

export function createSynth() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return createNullSynth();
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  let muted = false;
  let disposed = false;
  let bgmTimer = null;

  // shared noise buffer for slashes/hurts
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  {
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone({ type = "square", from = 440, to = from, dur = 0.12, peak = 0.18, delay = 0, curve = "exp" }) {
    if (muted || disposed) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) {
      if (curve === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    env(g, t0, peak, 0.005, dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.09, peak = 0.14, freq = 1800, q = 1.2, to = 0, delay = 0 }) {
    if (muted || disposed) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq, t0);
    if (to) bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    bp.Q.value = q;
    const g = ctx.createGain();
    env(g, t0, peak, 0.003, dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const sfx = {
    slash: () => noise({ dur: 0.08, peak: 0.12, freq: 2600, to: 700, q: 0.9 }),
    hit: () => {
      tone({ type: "square", from: 160, to: 60, dur: 0.09, peak: 0.16 });
      noise({ dur: 0.05, peak: 0.08, freq: 900, to: 300 });
    },
    kill: () => {
      tone({ type: "square", from: 340, to: 640, dur: 0.07, peak: 0.12 });
      tone({ type: "square", from: 680, to: 1020, dur: 0.09, peak: 0.1, delay: 0.06 });
    },
    hurt: () => {
      tone({ type: "sawtooth", from: 300, to: 70, dur: 0.22, peak: 0.2 });
      noise({ dur: 0.16, peak: 0.1, freq: 500, to: 150 });
    },
    heart: () => {
      tone({ type: "sine", from: 523, dur: 0.09, peak: 0.14 });
      tone({ type: "sine", from: 784, dur: 0.14, peak: 0.14, delay: 0.08 });
    },
    gem: () => tone({ type: "triangle", from: 988, to: 1319, dur: 0.09, peak: 0.12 }),
    open: () => tone({ type: "triangle", from: 660, to: 880, dur: 0.06, peak: 0.09 }),
    close: () => tone({ type: "triangle", from: 880, to: 660, dur: 0.06, peak: 0.08 }),
    region: () => {
      tone({ type: "sine", from: 659, dur: 0.12, peak: 0.12 });
      tone({ type: "sine", from: 988, dur: 0.2, peak: 0.12, delay: 0.11 });
    },
    combo: () => tone({ type: "square", from: 880, to: 1175, dur: 0.05, peak: 0.07 }),
    start: () => {
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ type: "square", from: f, dur: 0.1, peak: 0.12, delay: i * 0.09 })
      );
    },
    clear: () => {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
        tone({ type: "square", from: f, dur: 0.11, peak: 0.12, delay: i * 0.1 })
      );
    },
    gameover: () => {
      [392, 311, 262, 196].forEach((f, i) =>
        tone({ type: "sawtooth", from: f, dur: 0.22, peak: 0.14, delay: i * 0.18 })
      );
    },
  };

  /* ---- music: prefers a licensed track dropped at /game/music.mp3
     (e.g. an Epidemic Sound export), falls back to the synth loop ---- */
  let musicEl = null;
  let musicChecked = false;
  let bgmWanted = false;

  async function ensureMusic() {
    if (musicChecked) return musicEl;
    musicChecked = true;
    try {
      const res = await fetch("/game/music.mp3", { method: "HEAD" });
      if (res.ok && /audio|octet/.test(res.headers.get("content-type") || "")) {
        musicEl = new Audio("/game/music.mp3");
        musicEl.loop = true;
        musicEl.volume = 0.32;
      }
    } catch {}
    return musicEl;
  }

  /* ---- fallback bgm: 8-step lo-fi loop, lead + bass, very quiet ---- */
  const LEAD = [392, 0, 494, 392, 587, 0, 494, 440, 392, 0, 494, 523, 587, 659, 587, 494];
  const BASS = [98, 98, 123, 123, 147, 147, 123, 110];
  let step = 0;

  function bgmTick() {
    if (muted || disposed) return;
    const lead = LEAD[step % LEAD.length];
    const bass = BASS[Math.floor(step / 2) % BASS.length];
    if (lead) tone({ type: "square", from: lead, dur: 0.14, peak: 0.028 });
    if (step % 2 === 0) tone({ type: "triangle", from: bass, dur: 0.3, peak: 0.05 });
    if (step % 4 === 2) noise({ dur: 0.03, peak: 0.015, freq: 6000, q: 0.7 });
    step++;
  }

  return {
    play(name) {
      if (sfx[name]) sfx[name]();
    },
    startBgm() {
      if (disposed) return;
      bgmWanted = true;
      ensureMusic().then((el) => {
        if (disposed || !bgmWanted) return;
        if (el) {
          if (!muted) el.play().catch(() => {});
        } else if (!bgmTimer) {
          bgmTimer = setInterval(bgmTick, 180);
        }
      });
    },
    stopBgm() {
      bgmWanted = false;
      clearInterval(bgmTimer);
      bgmTimer = null;
      musicEl?.pause();
    },
    setMuted(m) {
      muted = m;
      if (musicEl) {
        if (m) musicEl.pause();
        else if (bgmWanted) musicEl.play().catch(() => {});
      }
    },
    get muted() {
      return muted;
    },
    resume() {
      if (ctx.state === "suspended") ctx.resume();
      if (musicEl && bgmWanted && !muted) musicEl.play().catch(() => {});
    },
    suspend() {
      if (ctx.state === "running") ctx.suspend();
      musicEl?.pause();
    },
    dispose() {
      disposed = true;
      clearInterval(bgmTimer);
      musicEl?.pause();
      musicEl = null;
      ctx.close().catch(() => {});
    },
  };
}

function createNullSynth() {
  const noop = () => {};
  return {
    play: noop,
    startBgm: noop,
    stopBgm: noop,
    setMuted: noop,
    muted: true,
    resume: noop,
    suspend: noop,
    dispose: noop,
  };
}
