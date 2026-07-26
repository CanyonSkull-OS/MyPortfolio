/*
  engine.js — the KAPLAY story overworld. buildGame(k, synth, bridge,
  { world, baked }) wires the pre-baked world texture (ONE object instead of
  ~3,400 tile objects), ~40 merged colliders, the 0x72-animated knight,
  gated west→east progression, region banners and monument cards.

  The shared mechanics — mob AI, combat, HUD widgets, scoring popups,
  pickups — live in common.js so the endless arena (arena.js) runs the exact
  same code. This file keeps only what is story-specific.

  bridge = {
    openPanel(data)      — show a monument card (world pauses)
    exit()               — leave game mode entirely
    onGameOver(score,hi) — show the DOM game-over screen
    onReady()            — first frame ready, hide the loading veil
    getTouchDir()        — {x,y} from the virtual d-pad (zero on desktop)
    takeTouchAttack()    — true once per queued touch attack
    takeTouchFire()      — true once per queued touch fireball
    enterArena()         — jump to the endless arena scene
  }
*/

import { loadDungeonSprites } from "./assets";
import { registerCharacters } from "./characters";
import {
  WORLD,
  MONUMENTS,
  MONUMENT_LABELS,
  PROGRESSION,
  regionAt,
} from "./content";
import {
  SPEED,
  FIRE_COST,
  MANA_MAX,
  MANA_REGEN,
  COMBO_WINDOW,
  comboMult,
  makeKit,
  makeHud,
  makePlayer,
  makeMobFactory,
  makeCombat,
  makePickups,
  floatScore,
} from "./common";
import { registerArenaScene } from "./arena";

const HI_KEY = "omer-arcade-hi";

// which sprite each monument uses: chests = projects, statue = story,
// fountain = the glowing interactive obelisks
const MONUMENT_LOOK = {
  A: "statue", B: "chest", C: "fountain", D: "statue", E: "chest",
  F: "chest", G: "statue", H: "statue", I: "fountain", J: "fountain",
};

export function buildGame(k, synth, bridge, { world, baked, arena, chars }) {
  const kit = makeKit(k);
  const { CREAM, ORANGE, INK, setCam, ptext, poof } = kit;

  k.setBackground(kit.hex("#001524"));
  // NOTE: the pixel font is preloaded as a browser FontFace ("pixel") in
  // GameMode BEFORE this runs, so kaplay renders it straight through
  // ctx.font. Loading it via kaplay's own atlas raced the first frame and
  // left blank (black-box) text on some Press Starts — do not re-add it.
  k.loadSprite("world", baked.url);
  loadDungeonSprites(k);
  registerCharacters(k, chars); // side-view character atlases (same load phase)
  k.loadSpriteAtlas("/game/terrain.png", {
    statue: { x: 51 * 17, y: 11 * 17, width: 16, height: 16 },
    fence: { x: 47 * 17, y: 22 * 17, width: 16, height: 16 },
  });

  const api = { resume: () => {}, restart: () => {}, isPaused: () => true };

  // Story progress lives OUT here, not in the scene closure — so a detour into
  // the arena (k.go("arena") destroys the world scene) and back doesn't wipe
  // the run. The scene reads this on entry; kills and monument-reads write
  // through live; the rest is snapshotted when the player enters the arcade.
  const run = {
    stepIdx: 0,
    stepKills: 0,
    score: 0,
    hearts: 3,
    bossDown: false,
    read: new Set(),
    killed: new Set(), // indices of spawners already defeated
  };
  const resetRun = () => {
    run.stepIdx = 0;
    run.stepKills = 0;
    run.score = 0;
    run.hearts = 3;
    run.bossDown = false;
    run.read.clear();
    run.killed.clear();
  };

  k.scene("world", () => {
    /* ---------------- state ---------------- */
    // hearts/score/bossDown/progress resume from `run` (restored after an
    // arena detour); combo/mana/facing are transient and always start fresh
    const state = {
      paused: false,
      over: false,
      hearts: run.hearts,
      score: run.score,
      combo: 0,
      lastKill: -99,
      iframeUntil: 0,
      attackAt: -99,
      chain: 0, // melee combo step (attack1→2→3); distinct from the score combo
      chainAt: -99,
      facing: k.vec2(0, 1),
      region: null,
      bossDown: run.bossDown,
      mana: MANA_MAX,
      castAt: -99,
      hi: Number(localStorage.getItem(HI_KEY) || 0),
    };

    /* ---------------- the world: one sprite + merged colliders ------- */
    k.add([k.sprite("world"), k.pos(0, 0), k.z(0)]);
    for (const c of baked.colliders) {
      k.add([
        k.pos(c.x, c.y),
        k.area({ shape: new k.Rect(k.vec2(0, 0), c.w, c.h) }),
        k.body({ isStatic: true }),
        "wall", // so fireballs burst on impact
      ]);
    }

    /* ---------------- monuments (9 objects, cached list) -------------- */
    const monumentObjs = baked.monumentSpots.map(({ ch, x, y }) => {
      const m = k.add([
        k.sprite(MONUMENT_LOOK[ch]),
        k.pos(x + 8, y + 16),
        k.anchor("bot"),
        k.z(y + 16),
        "monument",
        { mid: ch },
      ]);
      if (MONUMENT_LOOK[ch] === "fountain") m.play("play");
      // floating name label so players know what each thing is
      const label = MONUMENT_LABELS[ch];
      const lw = label.length * 8 + 8;
      k.add([
        k.rect(lw, 12),
        k.pos(x + 8, y - 8), k.anchor("center"),
        k.color(INK), k.opacity(0.65), k.z(3000),
      ]);
      k.add([
        ptext(label),
        k.pos(x + 8, y - 8), k.anchor("center"),
        k.color(CREAM), k.z(3001),
      ]);
      return m;
    });

    /* ---------------- progression gates ---------------- */
    const barriers = PROGRESSION.map((step) =>
      (step.gateCells || []).map(([gx, gy]) =>
        k.add([
          k.sprite("fence"),
          k.pos(gx * 16, gy * 16),
          k.area(),
          k.body({ isStatic: true }),
          k.z(gy * 16 + 16),
          "barrier",
        ])
      )
    );
    // resume progression; re-open any gates cleared before an arena detour
    state.stepIdx = run.stepIdx;
    state.stepKills = run.stepKills;
    for (let i = 0; i < state.stepIdx; i++) {
      (barriers[i] || []).forEach((b) => b.destroy());
    }
    const readSet = run.read; // same Set as run — monument reads persist

    function objectiveText() {
      const step = PROGRESSION[state.stepIdx];
      if (!step) return "FREE ROAM - CHASE THE SCORE";
      const kills = step.kills ? ` (${Math.min(state.stepKills, step.kills)}/${step.kills})` : "";
      return step.objective + kills;
    }

    function checkProgress() {
      const step = PROGRESSION[state.stepIdx];
      if (!step) return;
      const done =
        state.stepKills >= (step.kills || 0) &&
        readSet.has(step.monument) &&
        (!step.boss || state.bossDown);
      if (!done) {
        refreshHUD();
        return;
      }
      if (step.gateCells) {
        barriers[state.stepIdx].forEach((b) => {
          poof(b.pos.add(8, 8), "#ffecd1", 5);
          b.destroy();
        });
        synth.play("region");
        showBanner("GATE OPEN", step.gateName);
      } else {
        state.score += 1000;
        synth.play("clear");
        showBanner("PORTFOLIO CLEARED", "+1000 - free roam unlocked");
      }
      state.stepIdx += 1;
      state.stepKills = 0;
      refreshHUD();
    }

    /* ---------------- player (soldier: side-view, 3-hit combo) -------- */
    const player = makePlayer(k, kit, {
      x: world.playerSpawn.x * 16 + 8,
      y: world.playerSpawn.y * 16 + 14,
    });

    /* ---------------- HUD: shared widgets + story-specific lines ------ */
    const hud = makeHud(k, kit);
    // BEST line (story keeps a persisted high score); the arena has its own
    const hiUI = k.add([
      ptext(`BEST ${state.hi}`),
      k.pos(8, 40), k.fixed(), k.z(100), k.color(CREAM), k.opacity(0.5),
    ]);
    // objective lives bottom-left so it never collides with the centered
    // region banner up top; dark backing keeps it readable over water
    const objectiveBg = k.add([
      k.rect(10, 14),
      k.pos(4, 340), k.fixed(), k.z(99), k.color(INK), k.opacity(0.55),
    ]);
    const objectiveUI = k.add([
      ptext(""),
      k.pos(8, 344), k.fixed(), k.z(100), k.color(ORANGE),
    ]);
    const promptUI = k.add([
      ptext("PRESS E"),
      k.pos(320, 318), k.anchor("center"), k.fixed(), k.z(100),
      k.color(ORANGE), k.opacity(0),
    ]);
    // blinking "go east" nudge, shown once the region you're standing in
    // is already cleared (progression is strictly west→east)
    let showArrow = false;
    const arrowUI = k.add([
      ptext(">>", 16),
      k.pos(616, 180), k.anchor("center"), k.fixed(), k.z(99),
      k.color(ORANGE), k.opacity(0),
    ]);
    arrowUI.onUpdate(() => {
      arrowUI.opacity = showArrow
        ? 0.4 + 0.5 * (Math.sin(k.time() * 5) + 1) * 0.5
        : 0;
    });
    const REGION_ORDER = ["landing", "origins", "atompoint", "nexus", "beamhive"];

    const showBanner = hud.showBanner;

    function refreshHUD() {
      hud.refreshCore(state);
      hiUI.text = `BEST ${state.hi}`;
      objectiveUI.text = objectiveText();
      objectiveBg.width = objectiveUI.text.length * 8 + 8;
    }
    refreshHUD();

    /* ---------------- scoring ---------------- */
    function addScore(base, at) {
      const now = k.time();
      state.combo = now - state.lastKill <= COMBO_WINDOW ? state.combo + 1 : 1;
      state.lastKill = now;
      const gained = Math.round(base * comboMult(state.combo));
      state.score += gained;
      if (state.score > state.hi) {
        state.hi = state.score;
        localStorage.setItem(HI_KEY, String(state.hi));
      }
      if (state.combo > 1) synth.play("combo");
      refreshHUD();
      floatScore(k, kit, gained, at, state.combo > 1);
    }

    /* ---------------- combat / mobs / pickups (shared) ---------------- */
    const combat = makeCombat(k, synth, kit, {
      state,
      player,
      onMobDeath: (mob) => killMob(mob),
    });
    const spawnMob = makeMobFactory(k, synth, kit, {
      state,
      player,
      leash: true,
      onPlayerHit,
    });
    const pickups = makePickups(k, kit, synth, { state, refreshHUD });

    function killMob(mob) {
      if (mob.dying) return; // one death per mob
      const at = mob.pos.sub(0, 8);
      addScore(mob.scoreVal, at);
      poof(at, mob.type === "cron" ? "#ff7d00" : mob.type === "bug" ? "#a34a22" : "#2f8291", 9);
      synth.play("kill");
      if (mob.spawner) {
        mob.spawner.mob = null;
        run.killed.add(mob.spawner.idx); // stays dead across an arena detour
      }
      const roll = Math.random();
      if (roll < 0.12 && state.hearts < 3) pickups.dropPickup("flask", at);
      else if (roll < 0.34) pickups.dropPickup("coin", at);
      if (mob.type === "boss" && !state.bossDown) {
        state.bossDown = true;
        synth.play("clear");
        showBanner("GOLEM DOWN", "the raw list golem is no more");
        poof(at, "#ff7d00", 22);
      }
      // progression: kills only count in the current step's region
      const step = PROGRESSION[state.stepIdx];
      if (step && mob.spawner) {
        const r = regionAt(mob.spawner.x, mob.spawner.y);
        if (r && r.id === step.region) state.stepKills += 1;
      }
      mob.die(); // scoring already applied; play death anim, then despawn
      checkProgress();
    }

    // spawners are one-shot: a cleared region stays cleared — and stays
    // cleared across an arena detour too (run.killed tracks which are down)
    const spawners = world.spawns.map((s, i) => ({ ...s, idx: i, mob: null, respawnAt: 0 }));
    spawners.forEach((sp) => {
      if (!run.killed.has(sp.idx)) spawnMob(sp);
    });

    /* ---------------- player damage (from a mob attack's hit-frame) --- */
    function onPlayerHit(mob) {
      if (state.paused || state.over) return;
      const now = k.time();
      if (now < state.iframeUntil) return;
      state.iframeUntil = now + 1;
      state.hearts -= 1;
      state.combo = 0;
      refreshHUD();
      synth.play("hurt");
      k.shake(7);
      combat.playerHurt();
      mob.knock = mob.pos.sub(player.pos).unit().scale(80); // small self-nudge back
      const blink = k.loop(0.08, () => (player.opacity = player.opacity === 1 ? 0.3 : 1));
      k.wait(1, () => {
        blink.cancel();
        player.opacity = 1;
      });
      if (state.hearts <= 0) gameOver();
    }

    function gameOver() {
      if (state.over) return;
      state.over = true;
      synth.stopBgm();
      synth.play("gameover");
      k.shake(10);
      combat.playerDeath(() => bridge.onGameOver(state.score, state.hi));
    }

    /* ---------------- movement / input ---------------- */
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

      const moving = dir.len() > 0;
      if (moving) {
        dir = dir.unit();
        state.facing = dir;
        player.move(dir.scale(SPEED));
        // footstep dust
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
      }
      // walk/idle + face travel direction (attack/hurt anims own the sprite
      // while they play, so tickAnim leaves them alone)
      combat.tickAnim(moving, dir.x !== 0 ? dir.x < 0 : undefined);
      player.z = player.pos.y;

      if (bridge.takeTouchAttack()) combat.attack();
      if (bridge.takeTouchFire()) combat.fireball();

      // mana regenerates over time; bar dims when a cast is unaffordable
      state.mana = Math.min(MANA_MAX, state.mana + MANA_REGEN * k.dt());
      hud.updateMana(state.mana);

      const cx = Math.max(320, Math.min(player.pos.x, WORLD.W * 16 - 320));
      const cy = Math.max(180, Math.min(player.pos.y, WORLD.H * 16 - 180));
      setCam(k.vec2(cx, cy));
    });

    k.onMousePress("left", () => combat.attack()); // melee = left click
    k.onKeyPress("space", () => combat.fireball()); // ranged = space
    // M (mute) is handled by the DOM layer so the button icon stays in sync
    k.onKeyPress("escape", () => {
      if (state.paused) return; // panel open — GameMode handles closing
      bridge.exit();
    });

    /* ---------------- monuments ---------------- */
    let nearMonument = null;
    k.loop(0.12, () => {
      if (state.paused || state.over) return;
      let best = null;
      let bestD = 40;
      for (const m of monumentObjs) {
        const d = player.pos.dist(m.pos);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      nearMonument = best;
      promptUI.opacity = best ? 1 : 0;
    });

    k.onKeyPress("e", () => {
      if (state.paused || state.over || !nearMonument) return;
      // monument J is the arcade portal: a disclaimer card whose action enters
      // the arena. Snapshot the run first so the detour can't wipe progress.
      if (nearMonument.mid === "J") {
        run.stepIdx = state.stepIdx;
        run.stepKills = state.stepKills;
        run.score = state.score;
        run.hearts = state.hearts;
        run.bossDown = state.bossDown;
        state.paused = true;
        promptUI.opacity = 0;
        synth.play("open");
        bridge.openPanel(MONUMENTS.J);
        return;
      }
      state.paused = true;
      promptUI.opacity = 0;
      synth.play("open");
      readSet.add(nearMonument.mid);
      bridge.openPanel(MONUMENTS[nearMonument.mid]);
      checkProgress();
    });

    /* ---------------- region banners + proceed arrow ---------------- */
    k.loop(0.3, () => {
      if (state.paused || state.over) return;
      const r = regionAt(Math.floor(player.pos.x / 16));
      if (r && r.id !== state.region) {
        state.region = r.id;
        synth.play("region");
        showBanner(r.name, r.sub);
      }
      // arrow: current region's step already done, run not finished
      const ri = REGION_ORDER.indexOf(r?.id);
      showArrow = ri >= 0 && state.stepIdx > ri && state.stepIdx < PROGRESSION.length;
    });

    /* ---------------- api / debug ---------------- */
    api.resume = () => {
      state.paused = false;
      synth.play("close");
    };
    // a fresh story run — clears the persisted progress, then rebuilds
    api.restart = () => {
      resetRun();
      k.go("world");
    };
    api.isPaused = () => state.paused;

    window.__arcade = {
      pos: () => ({ x: player.pos.x, y: player.pos.y }),
      score: () => state.score,
      hearts: () => state.hearts,
      mana: () => Math.round(state.mana),
      fps: () => k.debug.fps(),
      paused: () => state.paused,
      over: () => state.over,
      arrow: () => showArrow,
      step: () => state.stepIdx,
      melee: () => combat.attack(),
      fire: () => combat.fireball(),
      enterArena: () => k.go("arena"),
      mobs: () =>
        k.get("mob").map((m) => ({ x: Math.round(m.pos.x), y: Math.round(m.pos.y), t: m.type })),
    };

    synth.play("start");
    synth.startBgm();
    showBanner("THE LANDING", "safe ground — go make some noise");
  });

  // the endless arena lives on the same KAPLAY handle, entered from the
  // portal monument in The Landing (or the debug hook)
  if (arena) registerArenaScene(k, synth, bridge, arena);
  api.enterArena = () => k.go("arena");
  api.enterStory = () => k.go("world");

  k.onLoad(() => {
    bridge.onReady?.();
    k.go("world");
  });
  return api;
}
