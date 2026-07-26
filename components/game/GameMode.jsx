"use client";

import { useEffect, useRef, useState } from "react";
import CharacterSelect from "./CharacterSelect";

/*
  GameMode — the full-screen arcade overlay. Owns the canvas, boots
  KAPLAY + the synth lazily on mount, and renders the DOM layer: monument
  cards (site typography, real links), game-over screen, mute/exit
  controls, and touch controls on coarse pointers. Everything tears down
  on unmount (k.quit + AudioContext.close), so the scroll site resumes
  exactly where it was.
*/
export default function GameMode({ onExit }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const synthRef = useRef(null);
  const touchDir = useRef({ x: 0, y: 0 });
  const touchAttack = useRef(false);
  const touchFire = useRef(false);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [muted, setMuted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [mode, setMode] = useState("story"); // "story" | "arena"
  const [hero, setHero] = useState(null); // chosen character; null → select screen
  const [name, setName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("omer-arcade-name") || "" : ""
  );
  // leaderboard submit: null | "sending" | { ok, rank, entries } | { error }
  const [submit, setSubmit] = useState(null);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    if (!hero) return; // wait for the character-select screen before booting

    let k = null;
    let destroyed = false;

    (async () => {
      const [
        { default: kaplay },
        { createSynth },
        { buildGame },
        { bakeWorld, bakeArena },
        { buildWorld },
        { prepareCharacters },
      ] = await Promise.all([
        import("kaplay"),
        import("./synth"),
        import("./engine"),
        import("./assets"),
        import("./content"),
        import("./characters"),
      ]);
      if (destroyed || !canvasRef.current) return;

      // The game canvas renders text with the "GamePixel" family — the same
      // CSS @font-face (globals.css) the DOM already uses, so it's loaded
      // reliably before the game mounts (unlike a canvas-only FontFace, which
      // raced and left blank/black-box labels). Belt-and-braces here: force
      // the EXACT glyphs kaplay draws to fully load at BOTH sizes, await
      // fonts.ready, poll document.fonts.check until the canvas subsystem
      // agrees, then a real fillText warm-up — so the first draw never caches
      // a blank glyph on a cold load.
      try {
        const GLYPHS =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 +-.,:!?%/()x·×>";
        await Promise.all([
          document.fonts.load("8px GamePixel", GLYPHS),
          document.fonts.load("16px GamePixel", GLYPHS),
        ]);
        await document.fonts.ready;
        for (
          let i = 0;
          i < 40 && !(document.fonts.check("8px GamePixel") && document.fonts.check("16px GamePixel"));
          i++
        ) {
          await new Promise((r) => setTimeout(r, 25));
        }
        const warm = document.createElement("canvas").getContext("2d");
        if (warm) {
          warm.font = "16px GamePixel";
          warm.fillText(GLYPHS, 0, 20);
          warm.font = "8px GamePixel";
          warm.fillText(GLYPHS, 0, 20);
        }
      } catch {}

      // bake both static maps + composite the character atlases before the
      // engine boots (all async prep done up front → one kaplay load phase)
      const world = buildWorld();
      const baked = await bakeWorld(world);
      const arena = await bakeArena();
      const chars = await prepareCharacters();
      if (destroyed || !canvasRef.current) return;

      const synth = createSynth();
      synthRef.current = synth;

      k = kaplay({
        global: false,
        canvas: canvasRef.current,
        width: 640,
        height: 360,
        letterbox: true,
        stretch: true,
        crisp: true,
        pixelDensity: 1,
        background: "#001524",
        touchToMouse: false,
        debug: false,
      });

      apiRef.current = buildGame(
        k,
        synth,
        {
          openPanel: (data) => setPanel(data),
          exit: () => onExit(),
          onGameOver: (score, hi) => setGameOver({ score, hi }),
          onReady: () => setReady(true),
          getTouchDir: () => touchDir.current,
          takeTouchAttack: () => {
            const q = touchAttack.current;
            touchAttack.current = false;
            return q;
          },
          takeTouchFire: () => {
            const q = touchFire.current;
            touchFire.current = false;
            return q;
          },
          // arena: return to the overworld + the endless game-over (submit)
          exitToStory: () => {
            setGameOver(null);
            setMode("story");
            apiRef.current?.enterStory?.();
            refocusCanvas();
          },
          onArenaOver: (score, wave, best) => {
            setSubmit(null); // fresh submit form each death
            setGameOver({ score, hi: best.bestScore, wave, arena: true });
          },
        },
        { world, baked, arena, chars, hero }
      );
    })();

    const onVis = () => {
      if (!synthRef.current) return;
      if (document.hidden) synthRef.current.suspend();
      else synthRef.current.resume();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", onVis);
      try {
        synthRef.current?.dispose();
      } catch {}
      try {
        k?.quit();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero]);

  // panel close (E or Esc) + mute keys live at the DOM layer
  useEffect(() => {
    const onKey = (e) => {
      // never hijack keys typed into the leaderboard name field
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Escape" || e.key === "e" || e.key === "E") && panel) {
        // stopPropagation keeps kaplay's canvas handler from re-opening it
        e.stopPropagation();
        closePanel();
      }
      if ((e.key === "m" || e.key === "M") && synthRef.current) {
        const next = !synthRef.current.muted;
        synthRef.current.setMuted(next);
        setMuted(next);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  // mobile: the arcade is built for landscape. Track orientation to show a
  // rotate prompt in portrait, and best-effort lock to landscape (works on
  // Android Chrome; iOS Safari ignores orientation lock, so the prompt is
  // the dependable fallback).
  useEffect(() => {
    if (!isTouch) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    (async () => {
      try {
        await document.documentElement.requestFullscreen?.();
        await window.screen?.orientation?.lock?.("landscape");
      } catch {}
    })();
    return () => {
      mq.removeEventListener("change", sync);
      try {
        window.screen?.orientation?.unlock?.();
      } catch {}
    };
  }, [isTouch]);

  // KAPLAY listens on the canvas: refocus it after any DOM interaction
  // or the keyboard goes dead until the player clicks the game again
  const refocusCanvas = () => requestAnimationFrame(() => canvasRef.current?.focus());

  const closePanel = () => {
    setPanel(null);
    apiRef.current?.resume();
    refocusCanvas();
  };

  const toggleMute = () => {
    if (!synthRef.current) return;
    const next = !synthRef.current.muted;
    synthRef.current.setMuted(next);
    setMuted(next);
    refocusCanvas();
  };

  const restart = () => {
    setGameOver(null);
    // arena runs it back into the arena; story restarts the overworld
    if (mode === "arena") apiRef.current?.enterArena?.();
    else apiRef.current?.restart();
    refocusCanvas();
  };

  // the arcade portal card's action — drop into the endless arena
  const enterArena = () => {
    setPanel(null);
    setMode("arena");
    apiRef.current?.enterArena?.();
    refocusCanvas();
  };

  // back to the character-select screen: tear down the current run (the boot
  // effect's cleanup fires when hero → null) and re-pick a fighter
  const changeHero = () => {
    setGameOver(null);
    setPanel(null);
    setSubmit(null);
    setMode("story");
    setReady(false);
    setHero(null);
  };

  // leave the arena back to the overworld (from the arena game-over card)
  const backToStory = () => {
    setGameOver(null);
    setPanel(null);
    setMode("story");
    apiRef.current?.enterStory?.();
    refocusCanvas();
  };

  const ERR_LABEL = {
    bad_name: "Pick a printable name (1–12 chars).",
    bad_score: "Score looked off — not submitted.",
    bad_wave: "Wave looked off — not submitted.",
    implausible: "Score didn't match the wave — not submitted.",
    rate_limited: "Too many submissions — wait a bit.",
    write_failed: "Server hiccup — try again.",
  };

  // submit the endless run to the global leaderboard
  const submitScore = async () => {
    const trimmed = name.trim();
    if (!trimmed || submit === "sending" || !gameOver) return;
    setSubmit("sending");
    try {
      localStorage.setItem("omer-arcade-name", trimmed);
    } catch {}
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, score: gameOver.score, wave: gameOver.wave }),
      });
      const data = await res.json();
      if (data.ok) setSubmit({ ok: true, rank: data.rank, entries: data.entries || [] });
      else setSubmit({ error: ERR_LABEL[data.error] || "Couldn't submit — try again." });
    } catch {
      setSubmit({ error: "Network error — try again." });
    }
  };

  const dpad = (x, y) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      touchDir.current = { x, y };
    },
    onPointerUp: () => (touchDir.current = { x: 0, y: 0 }),
    onPointerLeave: () => (touchDir.current = { x: 0, y: 0 }),
  });

  return (
    <div className="fixed inset-0 z-[100] bg-ink" role="application" aria-label="Portfolio arcade game">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* character-select comes before boot; loading veil only after a pick */}
      {!hero && <CharacterSelect onPick={setHero} onExit={onExit} />}

      {hero && !ready && (
        <div className="absolute inset-0 grid place-items-center bg-ink">
          <p className="label label-cream animate-pulse">Loading the arcade…</p>
        </div>
      )}

      {/* top controls — above the rotate overlay so exit stays reachable */}
      <div className="absolute right-4 top-4 z-[70] flex items-center gap-2">
        <button
          onClick={toggleMute}
          className="pill pill-cream !px-3 !py-2 text-sm"
          aria-label={muted ? "Unmute sound" : "Mute sound"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={onExit} className="pill pill-cream !px-4 !py-2 text-sm">
          Exit ✕
        </button>
      </div>

      {/* desktop hint — top center, clear of the canvas objective text */}
      {!isTouch && (
        <p className="game-pixel pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-cream/60">
          {mode === "arena"
            ? "WASD MOVE · LMB ATTACK · SPACE FIREBALL · ESC STORY"
            : "WASD MOVE · LMB ATTACK · SPACE FIREBALL · E READ · ESC EXIT"}
        </p>
      )}

      {/* monument card — pixel panel, not the site's card style */}
      {panel && (
        <div
          className="absolute inset-0 grid place-items-center bg-ink/70 p-4"
          onClick={closePanel}
        >
          <article
            className="game-card w-full max-w-md p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="game-pixel mb-4 text-[10px] uppercase text-orange">
              ◆ {panel.kicker}
            </p>
            <h3 className="game-pixel text-base leading-relaxed text-cream sm:text-lg">
              {panel.title.toUpperCase()}
            </h3>
            <p className="mt-4 font-mono text-[13px] leading-relaxed text-cream/80">
              {panel.body}
            </p>
            {panel.tags && (
              <div className="mt-5 flex flex-wrap gap-2">
                {panel.tags.map((t) => (
                  <span key={t} className="game-tag">
                    {t.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            {panel.links && (
              <div className="mt-6 flex flex-wrap gap-3">
                {panel.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-btn game-btn-orange"
                  >
                    {l.label.toUpperCase()} ↗
                  </a>
                ))}
              </div>
            )}
            {panel.action ? (
              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={enterArena} className="game-btn game-btn-orange">
                  {panel.action.label.toUpperCase()} →
                </button>
                <button onClick={closePanel} className="game-btn game-btn-ghost">
                  [E] NOT NOW
                </button>
              </div>
            ) : (
              <button onClick={closePanel} className="game-btn game-btn-ghost mt-7">
                [E] CLOSE
              </button>
            )}
          </article>
        </div>
      )}

      {/* game over — story vs endless-arena (with leaderboard submit) */}
      {gameOver && !gameOver.arena && (
        <div className="absolute inset-0 grid place-items-center bg-ink/80 p-4">
          <div className="game-card max-w-sm p-8 text-center">
            <p className="game-pixel mb-3 text-[10px] uppercase text-orange">Game over</p>
            <h3 className="game-pixel text-lg leading-relaxed text-cream">
              YOU GOT
              <br />
              AUTOMATED
            </h3>
            <p className="game-pixel mt-5 text-[10px] text-cream/80">
              SCORE <span className="text-orange">{gameOver.score}</span> · BEST {gameOver.hi}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={restart} className="game-btn">
                RUN IT BACK
              </button>
              <button onClick={changeHero} className="game-btn game-btn-ghost">
                CHANGE FIGHTER
              </button>
              <button onClick={onExit} className="game-btn game-btn-ghost">
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver && gameOver.arena && (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-ink/85 p-4">
          <div className="game-card w-full max-w-sm p-7 text-center">
            <p className="game-pixel mb-3 text-[10px] uppercase text-orange">Arcade over</p>
            <h3 className="game-pixel text-lg leading-relaxed text-cream">YOU FELL</h3>
            <p className="game-pixel mt-4 text-[10px] leading-relaxed text-cream/80">
              SCORE <span className="text-orange">{gameOver.score}</span>
              <br />
              WAVE {gameOver.wave} · BEST {gameOver.hi}
            </p>

            {/* submit form → success → error, in one place */}
            {submit?.ok ? (
              <div className="mt-6">
                <p className="game-pixel text-[10px] text-cream">
                  {submit.rank ? (
                    <>ON THE BOARD · <span className="text-orange">#{submit.rank}</span></>
                  ) : (
                    "SCORE SUBMITTED"
                  )}
                </p>
                {submit.entries.length > 0 && (
                  <ol className="mt-4 space-y-1.5 text-left">
                    {submit.entries.slice(0, 5).map((e, i) => (
                      <li
                        key={`${e.t}-${i}`}
                        className="game-pixel grid grid-cols-[1.1rem_1fr_auto] items-center gap-2 text-[9px] text-cream/85"
                      >
                        <span className={i === 0 ? "text-orange" : "text-cream/40"}>{i + 1}</span>
                        <span className="truncate uppercase">{e.name}</span>
                        <span className="tabular-nums text-cream">
                          {Number(e.score).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <label className="game-pixel mb-2 block text-[9px] uppercase text-cream/50">
                  Your name for the board
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitScore()}
                  maxLength={12}
                  placeholder="OMER"
                  aria-label="Leaderboard name"
                  className="game-pixel w-full border-2 border-cream/30 bg-ink px-3 py-2 text-center text-[11px] uppercase text-cream outline-none focus:border-orange"
                />
                {submit?.error && (
                  <p className="game-pixel mt-2 text-[8px] leading-relaxed text-orange">
                    {submit.error}
                  </p>
                )}
                <button
                  onClick={submitScore}
                  disabled={submit === "sending" || !name.trim()}
                  className="game-btn game-btn-orange mt-4 w-full disabled:opacity-40"
                >
                  {submit === "sending" ? "SENDING…" : "SUBMIT SCORE"}
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={restart} className="game-btn">
                PLAY AGAIN
              </button>
              <button onClick={backToStory} className="game-btn game-btn-ghost">
                TO STORY
              </button>
              <button onClick={changeHero} className="game-btn game-btn-ghost">
                CHANGE FIGHTER
              </button>
              <button onClick={onExit} className="game-btn game-btn-ghost">
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* touch controls */}
      {isTouch && ready && !panel && !gameOver && (
        <>
          <div className="absolute bottom-6 left-6 grid grid-cols-3 gap-1 select-none touch-none">
            <span />
            <button className="game-dbtn" {...dpad(0, -1)} aria-label="Up">▲</button>
            <span />
            <button className="game-dbtn" {...dpad(-1, 0)} aria-label="Left">◀</button>
            <span />
            <button className="game-dbtn" {...dpad(1, 0)} aria-label="Right">▶</button>
            <span />
            <button className="game-dbtn" {...dpad(0, 1)} aria-label="Down">▼</button>
            <span />
          </div>
          <button
            className="game-dbtn absolute bottom-9 right-8 !h-16 !w-16 !rounded-full !text-lg"
            onPointerDown={(e) => {
              e.preventDefault();
              touchAttack.current = true;
            }}
            aria-label="Sword attack"
          >
            ⚔️
          </button>
          <button
            className="game-dbtn absolute bottom-28 right-12 !h-14 !w-14 !rounded-full !text-lg"
            onPointerDown={(e) => {
              e.preventDefault();
              touchFire.current = true;
            }}
            aria-label="Cast fireball"
          >
            🔥
          </button>
        </>
      )}

      {/* mobile: rotate-to-landscape prompt */}
      {isTouch && portrait && (
        <div className="absolute inset-0 z-[65] grid place-items-center bg-ink p-8 text-center">
          <div className="game-pixel text-cream">
            <p className="mb-4 text-4xl">↻</p>
            <p className="text-sm leading-relaxed">ROTATE YOUR DEVICE</p>
            <p className="mt-3 text-[10px] leading-relaxed text-cream/60">
              THIS ADVENTURE PLAYS IN LANDSCAPE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
