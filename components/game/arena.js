/*
  arena.js — "Unlimited Arcade": an optional, endless wave mode reached from
  the portal monument in The Landing. One walled 40×22 room (static camera),
  progressively harder waves, fight until you die, submit the run to the
  global leaderboard.

  It reuses the shared mechanics from common.js (mob AI, combat, HUD, scoring,
  pickups) so it plays exactly like the story overworld — only the director
  (waves, scaling, telegraphed spawns, a static camera) is different.

  registerArenaScene(k, synth, bridge, arena) registers the "arena" scene on
  the same KAPLAY handle as the story. bridge adds two arena-only callbacks:
    onArenaOver(score, wave, best) — show the DOM game-over + submit card
    exitToStory()                 — go back to the overworld (k.go("world"))
*/

import {
  SPEED,
  FIRE_COST,
  MANA_MAX,
  MANA_REGEN,
  COMBO_WINDOW,
  comboMult,
  makeKit,
  makeHud,
  makeMobFactory,
  makeCombat,
  makePickups,
  floatScore,
} from "./common";

const BEST_KEY = "omer-arcade-endless"; // { bestScore, bestWave }
const MOB_CAP = 14; // hard concurrency cap — object count is the fps lever

function readBest() {
  try {
    const b = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
    return { bestScore: b.bestScore || 0, bestWave: b.bestWave || 0 };
  } catch {
    return { bestScore: 0, bestWave: 0 };
  }
}

/*
  Wave design. count/hp/speed/score all scale with the wave number; the type
  mix unlocks over time, with elite (wave 5, 9, then every 5th) and boss
  (wave 10, then every 10th) checkpoints. count is capped at MOB_CAP.
*/
function waveComposition(w, rand) {
  const count = Math.min(4 + Math.floor(w * 0.8), MOB_CAP);
  const hpMul = 1 + Math.floor((w - 1) / 4) * 0.5; // +50% HP every 4 waves
  const speedMul = Math.min(1 + (w - 1) * 0.03, 1.6); // capped so it stays readable
  const scoreMul = 1 + (w - 1) * 0.15; // late waves pay more

  const isBoss = w === 10 || (w > 10 && w % 10 === 0);
  const isElite = !isBoss && (w === 5 || w === 9 || (w > 10 && w % 5 === 0));

  const pick = (pool) => pool[Math.floor(rand() * pool.length)];
  const base = { hpMul, speedMul, scoreMul };
  const specs = [];

  if (isBoss) {
    // one golem, slowed a touch so it's readable, plus a handful of adds
    specs.push({ type: "boss", ...base, speedMul: Math.min(speedMul, 1.25) });
    const adds = Math.min(count - 1, 6);
    for (let i = 0; i < adds; i++) specs.push({ type: pick(["bug", "punch"]), ...base });
    return { specs, label: "BOSS WAVE", banner: "THE GOLEM RETURNS" };
  }

  let pool;
  if (w <= 2) pool = ["bug"];
  else if (w <= 4) pool = ["bug", "slime"];
  else if (w <= 8) pool = ["bug", "slime", "punch"];
  else pool = ["bug", "slime", "punch", "cron"];

  if (isElite) {
    // heavier roster, a little tougher, worth more
    pool = ["punch", "cron"];
    for (let i = 0; i < count; i++) {
      specs.push({ type: pick(pool), hpMul: hpMul * 1.3, speedMul, scoreMul: scoreMul * 1.3 });
    }
    return { specs, label: "ELITE WAVE", banner: "ELITES INCOMING" };
  }

  for (let i = 0; i < count; i++) specs.push({ type: pick(pool), ...base });
  return { specs, label: null, banner: null };
}

export function registerArenaScene(k, synth, bridge, arena) {
  k.loadSprite("arena", arena.url);

  k.scene("arena", () => {
    const kit = makeKit(k);
    const { CREAM, ORANGE, INK, setCam, ptext, lerpAngle, poof, addShadow } = kit;
    const rand = Math.random;

    /* ---------------- state ---------------- */
    const state = {
      paused: false,
      over: false,
      hearts: 3,
      score: 0,
      combo: 0,
      lastKill: -99,
      iframeUntil: 0,
      attackAt: -99,
      facing: k.vec2(0, 1),
      mana: MANA_MAX,
      castAt: -99,
      wave: 0,
      alive: 0, // mobs still to be defeated this wave (incl. not-yet-spawned)
    };
    const best = readBest();

    /* ---------------- room: one sprite + merged colliders ---------------- */
    k.add([k.sprite("arena"), k.pos(0, 0), k.z(0)]);
    for (const c of arena.colliders) {
      k.add([
        k.pos(c.x, c.y),
        k.area({ shape: new k.Rect(k.vec2(0, 0), c.w, c.h) }),
        k.body({ isStatic: true }),
        "wall",
      ]);
    }

    /* ---------------- player ---------------- */
    const player = k.add([
      k.sprite("hero-idle"),
      k.pos(arena.playerSpawn.x, arena.playerSpawn.y),
      k.area({ shape: new k.Rect(k.vec2(-5, -8), 10, 8) }),
      k.body(),
      k.anchor("bot"),
      k.z(10),
      k.opacity(1),
      "player",
    ]);
    player.play("play");
    addShadow(player, 5.5);
    let curSprite = "hero-idle";
    function setHeroSprite(name, flipX) {
      if (curSprite !== name) {
        player.use(k.sprite(name));
        player.play("play");
        curSprite = name;
      }
      player.flipX = flipX;
    }
    const swordPivot = player.add([k.pos(0, -10), k.rotate(215), k.z(1)]);
    swordPivot.add([k.sprite("sword"), k.pos(0, -3), k.anchor("bot")]);
    const faceAngle = () =>
      Math.atan2(state.facing.y, state.facing.x) * (180 / Math.PI) + 90;

    /* ---------------- HUD: shared widgets + arena lines ---------------- */
    const hud = makeHud(k, kit);
    const waveUI = k.add([
      ptext("WAVE 1"),
      k.pos(8, 40), k.fixed(), k.z(100), k.color(CREAM), k.opacity(0.6),
    ]);
    const bestUI = k.add([
      ptext(`BEST ${best.bestScore}`),
      k.pos(632, 8), k.anchor("topright"), k.fixed(), k.z(100),
      k.color(CREAM), k.opacity(0.45),
    ]);
    const enemiesBg = k.add([
      k.rect(10, 14),
      k.pos(4, 340), k.fixed(), k.z(99), k.color(INK), k.opacity(0.55),
    ]);
    const enemiesUI = k.add([
      ptext(""),
      k.pos(8, 344), k.fixed(), k.z(100), k.color(ORANGE),
    ]);

    function refreshHUD() {
      hud.refreshCore(state);
      waveUI.text = `WAVE ${state.wave}`;
      bestUI.text = `BEST ${best.bestScore}`;
      enemiesUI.text = state.alive > 0 ? `ENEMIES ${state.alive}` : "";
      enemiesBg.width = enemiesUI.text.length * 8 + 8;
    }

    /* ---------------- scoring ---------------- */
    function addScore(base_, at) {
      const now = k.time();
      state.combo = now - state.lastKill <= COMBO_WINDOW ? state.combo + 1 : 1;
      state.lastKill = now;
      const gained = Math.round(base_ * comboMult(state.combo));
      state.score += gained;
      if (state.score > best.bestScore) best.bestScore = state.score;
      if (state.combo > 1) synth.play("combo");
      refreshHUD();
      floatScore(k, kit, gained, at, state.combo > 1);
    }

    /* ---------------- combat / mobs / pickups (shared) ---------------- */
    const combat = makeCombat(k, synth, kit, {
      state,
      player,
      swordPivot,
      onMobDeath: (mob) => killMob(mob),
    });
    // leash:false → wave mobs commit to the player across the whole room
    const spawnMob = makeMobFactory(k, kit, { state, player, leash: false });
    const pickups = makePickups(k, kit, synth, { state, refreshHUD });

    function killMob(mob) {
      const at = mob.pos.sub(0, 8);
      addScore(mob.scoreVal, at);
      poof(at, mob.type === "cron" ? "#ff7d00" : mob.type === "bug" ? "#a34a22" : "#2f8291", 9);
      synth.play("kill");
      const roll = Math.random();
      if (roll < 0.12 && state.hearts < 3) pickups.dropPickup("flask", at);
      else if (roll < 0.34) pickups.dropPickup("coin", at);
      if (mob.type === "boss") {
        synth.play("clear");
        hud.showBanner("GOLEM DOWN", "keep going");
        poof(at, "#ff7d00", 22);
      }
      mob.destroy();
      state.alive -= 1;
      refreshHUD();
      if (state.alive <= 0 && !state.over) waveClear();
    }

    /* ---------------- wave director ---------------- */
    function spawnAt(spec, alcove, delay) {
      const [tx, ty] = alcove;
      const at = k.vec2(tx * 16 + 8, ty * 16 + 14);
      // telegraph: a puff where the mob is about to appear, mob lands after
      poof(at, "#ff7d00", 6);
      k.wait(delay, () => {
        if (state.over) return;
        spawnMob({ type: spec.type, x: tx, y: ty, hpMul: spec.hpMul, speedMul: spec.speedMul, scoreMul: spec.scoreMul });
      });
    }

    function startWave() {
      if (state.over) return;
      state.wave += 1;
      const { specs, label, banner } = waveComposition(state.wave, rand);
      state.alive = specs.length;
      refreshHUD();
      hud.showBanner(`WAVE ${state.wave}`, label || banner || "survive");

      // stagger spawns across the alcoves with a short telegraph so the
      // player is never spawn-camped
      specs.forEach((spec, i) => {
        const alcove = arena.alcoves[i % arena.alcoves.length];
        spawnAt(spec, alcove, 0.6 + i * 0.12);
      });
    }

    function waveClear() {
      const bonus = state.wave * 100;
      state.score += bonus;
      if (state.score > best.bestScore) best.bestScore = state.score;
      synth.play("clear");
      hud.showBanner("WAVE CLEAR", `+${bonus}`);
      // a breather heal every third wave, dropped at the room's centre
      if (state.wave % 3 === 0) {
        pickups.dropPickup("flask", k.vec2(arena.playerSpawn.x, arena.playerSpawn.y));
      }
      refreshHUD();
      k.wait(2.5, () => {
        if (!state.over) startWave();
      });
    }

    /* ---------------- player damage ---------------- */
    k.onCollide("player", "mob", (p, mob) => {
      if (state.paused || state.over) return;
      const now = k.time();
      if (now < state.iframeUntil) return;
      state.iframeUntil = now + 1;
      state.hearts -= 1;
      state.combo = 0;
      refreshHUD();
      synth.play("hurt");
      k.shake(7);
      mob.knock = mob.pos.sub(player.pos).unit().scale(120);
      const blink = k.loop(0.08, () => (player.opacity = player.opacity === 1 ? 0.3 : 1));
      k.wait(1, () => {
        blink.cancel();
        player.opacity = 1;
      });
      if (state.hearts <= 0) gameOver();
    });

    function gameOver() {
      if (state.over) return;
      state.over = true;
      // persist the personal best (score + furthest wave)
      best.bestScore = Math.max(best.bestScore, state.score);
      best.bestWave = Math.max(best.bestWave, state.wave);
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(best));
      } catch {}
      synth.stopBgm();
      synth.play("gameover");
      k.shake(10);
      bridge.onArenaOver?.(state.score, state.wave, { ...best });
    }

    /* ---------------- movement / input (static camera) ---------------- */
    let dustT = 0;
    k.onUpdate(() => {
      if (state.paused || state.over) return;

      let dir = k.vec2(0, 0);
      if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
      if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
      if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
      if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;
      const t = bridge.getTouchDir();
      if (t.x || t.y) dir = k.vec2(t.x, t.y);

      if (dir.len() > 0) {
        dir = dir.unit();
        state.facing = dir;
        player.move(dir.scale(SPEED));
        setHeroSprite("hero-run", dir.x < 0);
        dustT -= k.dt();
        if (dustT <= 0) {
          dustT = 0.18;
          k.add([
            k.rect(2, 2), k.pos(player.pos.add(Math.random() * 6 - 3, -1)),
            k.color(INK), k.opacity(0.35), k.z(2),
            k.move(k.vec2(0, -0.3), 6),
            k.lifespan(0.05, { fade: 0.3 }),
          ]);
        }
      } else {
        setHeroSprite("hero-idle", player.flipX);
      }
      player.z = player.pos.y;

      if (!combat.isSwinging()) {
        swordPivot.angle = lerpAngle(swordPivot.angle, faceAngle() + 35, k.dt() * 14);
      }

      if (bridge.takeTouchAttack()) combat.attack();
      if (bridge.takeTouchFire()) combat.fireball();

      state.mana = Math.min(MANA_MAX, state.mana + MANA_REGEN * k.dt());
      hud.updateMana(state.mana);
    });

    k.onMousePress("left", () => combat.attack());
    k.onKeyPress("space", () => combat.fireball());
    // Esc leaves the arena back to the overworld (not the whole game), so the
    // detour is truly optional
    k.onKeyPress("escape", () => {
      if (state.over) return;
      synth.stopBgm();
      bridge.exitToStory?.();
    });

    /* ---------------- camera: fixed on the room centre ---------------- */
    setCam(k.vec2((arena.W * 16) / 2, (arena.H * 16) / 2));

    /* ---------------- api / debug ---------------- */
    window.__arcade = {
      pos: () => ({ x: player.pos.x, y: player.pos.y }),
      score: () => state.score,
      hearts: () => state.hearts,
      mana: () => Math.round(state.mana),
      fps: () => k.debug.fps(),
      paused: () => state.paused,
      over: () => state.over,
      wave: () => state.wave,
      aliveMobs: () => k.get("mob").length,
      alive: () => state.alive,
      melee: () => combat.attack(),
      fire: () => combat.fireball(),
      mobs: () =>
        k.get("mob").map((m) => ({ x: Math.round(m.pos.x), y: Math.round(m.pos.y), t: m.type })),
    };

    synth.play("start");
    synth.startBgm();
    hud.showBanner("UNLIMITED ARCADE", "endless — good luck");
    refreshHUD();
    k.wait(1.6, () => startWave());
  });
}
