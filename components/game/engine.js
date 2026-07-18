/*
  engine.js — the KAPLAY game. buildGame(k, synth, bridge, { world, baked })
  wires everything: the pre-baked world texture (ONE object instead of
  ~3,400 tile objects), ~40 merged colliders, 0x72-animated knight + mobs,
  combat, combo scoring, region banners, monument cards.

  bridge = {
    openPanel(data)      — show a monument card (world pauses)
    exit()               — leave game mode entirely
    onGameOver(score,hi) — show the DOM game-over screen
    onReady()            — first frame ready, hide the loading veil
    getTouchDir()        — {x,y} from the virtual d-pad (zero on desktop)
    takeTouchAttack()    — true once per queued touch attack
  }
*/

import { loadDungeonSprites } from "./assets";
import {
  WORLD,
  MONUMENTS,
  MONUMENT_LABELS,
  PROGRESSION,
  regionAt,
} from "./content";

const SPEED = 92;
const ATTACK_CD = 0.3;
const COMBO_WINDOW = 3;
const HI_KEY = "omer-arcade-hi";

// idle: the standing anim shown when a mob is paused or pressed against
// a wall (slugs only have the one anim — it reads as idling anyway)
const MOB_TYPES = {
  bug: { sprite: "goblin", idle: "goblin-idle", hp: 1, speed: 55, score: 50, chase: 110 },
  slime: { sprite: "slug", idle: "slug", hp: 2, speed: 34, score: 100, chase: 120 },
  punch: { sprite: "zombie", idle: "zombie-idle", hp: 2, speed: 46, score: 150, chase: 130 },
  cron: { sprite: "chort", idle: "chort-idle", hp: 3, speed: 26, score: 200, chase: 130 },
  boss: { sprite: "demon", idle: "demon-idle", hp: 20, speed: 22, score: 500, chase: 170 },
};

// which sprite each monument uses: chests = projects, statue = story,
// fountain = the glowing interactive obelisks
const MONUMENT_LOOK = {
  A: "statue", B: "chest", C: "fountain", D: "statue", E: "chest",
  F: "chest", G: "statue", H: "statue", I: "fountain",
};

export function buildGame(k, synth, bridge, { world, baked }) {
  const hex = (h) => k.Color.fromHex(h);
  const CREAM = hex("#ffecd1");
  const ORANGE = hex("#ff7d00");
  const INK = hex("#001524");
  const setCam = (v) => (k.setCamPos ? k.setCamPos(v) : k.camPos(v));

  k.setBackground(hex("#001524"));
  k.loadFont("pixel", "/game/pixel.ttf");
  k.loadSprite("world", baked.url);
  loadDungeonSprites(k);
  k.loadSpriteAtlas("/game/terrain.png", {
    statue: { x: 51 * 17, y: 11 * 17, width: 16, height: 16 },
    fence: { x: 47 * 17, y: 22 * 17, width: 16, height: 16 },
  });

  // all in-canvas text uses the pixel font at 8px multiples (it's an
  // 8x8-grid face; other sizes turn to mush under crisp upscaling)
  const ptext = (str, size = 8) => k.text(str, { size, font: "pixel" });

  function lerpAngle(a, b, t) {
    const d = ((b - a + 540) % 360) - 180;
    return a + d * Math.min(t, 1);
  }

  const api = { resume: () => {}, restart: () => {}, isPaused: () => true };

  k.scene("world", () => {
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
      region: null,
      bossDown: false,
      hi: Number(localStorage.getItem(HI_KEY) || 0),
    };

    /* ---------------- the world: one sprite + merged colliders ------- */
    k.add([k.sprite("world"), k.pos(0, 0), k.z(0)]);
    for (const c of baked.colliders) {
      k.add([
        k.pos(c.x, c.y),
        k.area({ shape: new k.Rect(k.vec2(0, 0), c.w, c.h) }),
        k.body({ isStatic: true }),
      ]);
    }

    /* shadows: standalone followers kept under the entities */
    function addShadow(owner, rx = 5) {
      const sh = k.add([
        k.circle(rx),
        k.pos(owner.pos),
        k.scale(1, 0.45),
        k.color(0, 10, 18),
        k.opacity(0.25),
        k.z(1),
      ]);
      sh.onUpdate(() => {
        sh.pos = owner.pos.add(0, -1);
      });
      owner.onDestroy(() => sh.destroy());
      return sh;
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
    state.stepIdx = 0;
    state.stepKills = 0;
    const readSet = new Set();

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

    /* ---------------- player ---------------- */
    const player = k.add([
      k.sprite("hero-idle"),
      k.pos(world.playerSpawn.x * 16 + 8, world.playerSpawn.y * 16 + 14),
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

    // the sword orbits a pivot at the knight's hands and always rests
    // toward the facing direction; swings sweep an arc around it
    const swordPivot = player.add([k.pos(0, -10), k.rotate(215), k.z(1)]);
    swordPivot.add([k.sprite("sword"), k.pos(0, -3), k.anchor("bot")]);
    let swinging = false;
    const faceAngle = () =>
      Math.atan2(state.facing.y, state.facing.x) * (180 / Math.PI) + 90;

    /* ---------------- HUD (in-canvas, fixed) ---------------- */
    const heartsUI = [0, 1, 2].map((i) =>
      k.add([k.sprite("heart-full"), k.pos(8 + i * 15, 7), k.fixed(), k.z(100)])
    );
    const scoreUI = k.add([
      ptext("SCORE 0"),
      k.pos(8, 26), k.fixed(), k.z(100), k.color(CREAM),
    ]);
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
    const comboUI = k.add([
      ptext(""),
      k.pos(8, 54), k.fixed(), k.z(100), k.color(ORANGE),
    ]);
    const bannerUI = k.add([
      ptext("", 16),
      k.pos(320, 40), k.anchor("center"), k.fixed(), k.z(100),
      k.color(CREAM), k.opacity(0),
    ]);
    const bannerSubUI = k.add([
      ptext(""),
      k.pos(320, 58), k.anchor("center"), k.fixed(), k.z(100),
      k.color(ORANGE), k.opacity(0),
    ]);
    const promptUI = k.add([
      ptext("PRESS E"),
      k.pos(320, 318), k.anchor("center"), k.fixed(), k.z(100),
      k.color(ORANGE), k.opacity(0),
    ]);
    const fpsUI = k.add([
      ptext(""),
      k.pos(632, 352), k.anchor("botright"), k.fixed(), k.z(100),
      k.color(CREAM), k.opacity(0.35),
    ]);
    k.loop(0.5, () => (fpsUI.text = `${k.debug.fps()} FPS`));

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

    let heartState = [true, true, true];
    function refreshHUD() {
      heartsUI.forEach((h, i) => {
        const full = i < state.hearts;
        if (heartState[i] !== full) {
          h.use(k.sprite(full ? "heart-full" : "heart-empty"));
          heartState[i] = full;
        }
      });
      scoreUI.text = `SCORE ${state.score}`;
      hiUI.text = `BEST ${state.hi}`;
      objectiveUI.text = objectiveText();
      objectiveBg.width = objectiveUI.text.length * 8 + 8;
      comboUI.text = state.combo > 1 ? `COMBO x${comboMult().toFixed(1)}` : "";
    }
    refreshHUD();

    function showBanner(title, sub) {
      bannerUI.text = title;
      bannerSubUI.text = (sub || "").toUpperCase();
      k.tween(bannerUI.opacity, 1, 0.35, (v) => {
        bannerUI.opacity = v;
        bannerSubUI.opacity = v;
      });
      k.wait(2.2, () =>
        k.tween(bannerUI.opacity, 0, 0.6, (v) => {
          bannerUI.opacity = v;
          bannerSubUI.opacity = v;
        })
      );
    }

    /* ---------------- scoring ---------------- */
    function comboMult() {
      return Math.min(1 + 0.5 * (state.combo - 1), 4);
    }

    function addScore(base, at) {
      const now = k.time();
      state.combo = now - state.lastKill <= COMBO_WINDOW ? state.combo + 1 : 1;
      state.lastKill = now;
      const gained = Math.round(base * comboMult());
      state.score += gained;
      if (state.score > state.hi) {
        state.hi = state.score;
        localStorage.setItem(HI_KEY, String(state.hi));
      }
      if (state.combo > 1) synth.play("combo");
      refreshHUD();
      k.add([
        ptext(`+${gained}`),
        k.pos(at), k.anchor("center"), k.z(2000),
        k.color(state.combo > 1 ? ORANGE : CREAM),
        k.move(k.vec2(0, -1), 34),
        k.opacity(1), k.lifespan(0.15, { fade: 0.5 }),
      ]);
    }

    function poof(at, colorHexStr, n = 7) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        k.add([
          k.rect(2, 2), k.pos(at), k.z(1500), k.color(hex(colorHexStr)),
          k.move(k.vec2(Math.cos(a), Math.sin(a)), 40 + Math.random() * 50),
          k.opacity(1), k.lifespan(0.1, { fade: 0.3 }),
        ]);
      }
    }

    /* ---------------- mobs ---------------- */
    const spawners = world.spawns.map((s) => ({ ...s, mob: null, respawnAt: 0 }));

    function spawnMob(sp) {
      const cfg = MOB_TYPES[sp.type];
      const isBoss = sp.type === "boss";
      const mob = k.add([
        k.sprite(cfg.sprite),
        k.pos(sp.x * 16 + 8, sp.y * 16 + 14),
        k.area({
          shape: new k.Rect(
            k.vec2(isBoss ? -10 : -6, isBoss ? -10 : -7),
            isBoss ? 20 : 12,
            isBoss ? 10 : 7
          ),
        }),
        k.body(),
        k.anchor("bot"),
        k.scale(1),
        k.z(10),
        k.opacity(1),
        k.offscreen({ hide: true, distance: 80 }),
        "mob",
        {
          type: sp.type,
          hp: cfg.hp,
          speedBase: cfg.speed,
          chaseR: cfg.chase,
          scoreVal: cfg.score,
          wanderDir: k.vec2(0, 0),
          wanderT: 0,
          knock: k.vec2(0, 0),
          spawner: sp,
          homePos: k.vec2(sp.x * 16 + 8, sp.y * 16 + 14),
        },
      ]);
      mob.play("play");
      addShadow(mob, isBoss ? 11 : 5);
      if (isBoss) {
        // the golem carries a name tag
        const tagBg = k.add([
          k.rect(15 * 8 + 8, 12), k.pos(mob.pos), k.anchor("center"),
          k.color(0, 21, 36), k.opacity(0.65), k.z(3000),
        ]);
        const tag = k.add([
          ptext("RAW LIST GOLEM"), k.pos(mob.pos), k.anchor("center"),
          k.color(ORANGE), k.z(3001),
        ]);
        const sync = () => {
          tagBg.pos = mob.pos.sub(0, 44);
          tag.pos = tagBg.pos;
        };
        sync();
        mob.onUpdate(sync);
        mob.onDestroy(() => {
          tagBg.destroy();
          tag.destroy();
        });
      }
      // anim follows real displacement, so a mob pressed against a wall
      // stands instead of running in place
      mob.curSprite = cfg.sprite;
      mob.prevPos = mob.pos.clone();
      mob.stuckT = 0;
      mob.blockedDir = null;
      const setMobSprite = (name) => {
        if (mob.curSprite === name) return;
        mob.curSprite = name;
        mob.use(k.sprite(name));
        mob.play("play");
      };

      mob.onUpdate(() => {
        if (state.paused || state.over) return;
        mob.z = mob.pos.y; // depth sort
        const moved = mob.pos.dist(mob.prevPos); // last frame's real motion
        mob.prevPos = mob.pos.clone();
        const d = player.pos.dist(mob.pos);
        if (d > 420) return; // sleep far away

        if (mob.knock.len() > 1) {
          mob.move(mob.knock);
          mob.knock = mob.knock.scale(1 - Math.min(k.dt() * 10, 0.9));
        } else if (mob.pos.dist(mob.homePos) > 150) {
          // leash: stay in your region
          mob.move(mob.homePos.sub(mob.pos).unit().scale(mob.speedBase * 0.7));
          mob.flipX = mob.homePos.x < mob.pos.x;
        } else if (d < mob.chaseR) {
          mob.move(player.pos.sub(mob.pos).unit().scale(mob.speedBase));
          mob.flipX = player.pos.x < mob.pos.x;
        } else {
          mob.wanderT -= k.dt();
          if (mob.wanderT <= 0) {
            mob.wanderT = 1 + Math.random() * 1.5;
            if (Math.random() < 0.35 && !mob.blockedDir) {
              mob.wanderDir = k.vec2(0, 0);
            } else {
              // pick a fresh heading, away from any wall we just hit
              let nd = k.vec2(0, 0);
              for (let i = 0; i < 5; i++) {
                const a = Math.random() * Math.PI * 2;
                nd = k.vec2(Math.cos(a), Math.sin(a));
                if (!mob.blockedDir || nd.dot(mob.blockedDir) <= 0.2) break;
              }
              mob.wanderDir = nd;
              mob.blockedDir = null;
            }
          }
          if (mob.wanderDir.len() > 0) {
            mob.flipX = mob.wanderDir.x < 0;
            mob.move(mob.wanderDir.scale(mob.speedBase * 0.4));
            // wall bump: wanted to walk but barely displaced → stand a
            // beat, then head somewhere else
            if (moved < k.dt() * mob.speedBase * 0.1) {
              mob.stuckT += k.dt();
              if (mob.stuckT > 0.25) {
                mob.stuckT = 0;
                mob.blockedDir = mob.wanderDir.clone();
                mob.wanderDir = k.vec2(0, 0);
                mob.wanderT = 0.6 + Math.random() * 0.9;
              }
            } else {
              mob.stuckT = 0;
            }
          }
        }

        setMobSprite(moved > k.dt() * 4 ? cfg.sprite : cfg.idle);
      });
      sp.mob = mob;
      return mob;
    }

    // spawners are one-shot: a cleared region stays cleared
    spawners.forEach((sp) => spawnMob(sp));

    function killMob(mob) {
      const at = mob.pos.sub(0, 8);
      addScore(mob.scoreVal, at);
      poof(at, mob.type === "cron" ? "#ff7d00" : mob.type === "bug" ? "#a34a22" : "#2f8291", 9);
      synth.play("kill");
      if (mob.spawner) mob.spawner.mob = null;
      const roll = Math.random();
      if (roll < 0.12 && state.hearts < 3) dropPickup("flask", at);
      else if (roll < 0.34) dropPickup("coin", at);
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
      mob.destroy();
      checkProgress();
    }

    function dropPickup(kind, at) {
      const p = k.add([
        k.sprite(kind),
        k.pos(at.add(k.vec2(Math.random() * 10 - 5, Math.random() * 8))),
        k.area(), k.anchor("bot"), k.z(5),
        "pickup", { kind },
        k.opacity(1),
        k.lifespan(9, { fade: 1.5 }),
      ]);
      if (kind === "coin") p.play("play");
    }

    k.onCollide("player", "pickup", (p, pk) => {
      if (pk.kind === "flask") {
        state.hearts = Math.min(3, state.hearts + 1);
        synth.play("heart");
      } else {
        state.score += 75;
        synth.play("gem");
      }
      refreshHUD();
      poof(pk.pos, "#ffecd1", 5);
      pk.destroy();
    });

    /* ---------------- combat ---------------- */
    function damageMob(mob) {
      mob.hp -= 1;
      synth.play("hit");
      k.shake(3);
      mob.knock = mob.pos.sub(player.pos).unit().scale(190);
      const s0 = mob.scale.x;
      k.tween(s0 * 1.22, s0, 0.15, (v) => mob.scaleTo(v));
      if (mob.hp <= 0) killMob(mob);
    }

    function attack() {
      const now = k.time();
      if (now - state.attackAt < ATTACK_CD || state.paused || state.over) return;
      state.attackAt = now;
      synth.play("slash");

      const dir = state.facing;
      const ang = faceAngle();

      swinging = true;
      swordPivot.angle = ang - 85;
      k.tween(ang - 85, ang + 70, 0.13, (v) => (swordPivot.angle = v), k.easings.easeOutQuad)
        .then(() => {
          swinging = false; // idle lerp reclaims the rest pose
        });

      // direct arc check — a collision-object hitbox proved unreliable
      for (const mob of k.get("mob")) {
        const to = mob.pos.sub(player.pos);
        const reach = 46 + (mob.type === "boss" ? 16 : 0);
        const d = to.len();
        if (d > reach) continue;
        // must be roughly in front, unless point-blank (16 ≈ contact range,
        // so a mob chewing on your back is always hittable)
        if (d > 16 && to.unit().dot(dir) < 0.2) continue;
        damageMob(mob);
      }
    }

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
      state.over = true;
      synth.stopBgm();
      synth.play("gameover");
      k.shake(10);
      bridge.onGameOver(state.score, state.hi);
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

      if (dir.len() > 0) {
        dir = dir.unit();
        state.facing = dir;
        player.move(dir.scale(SPEED));
        setHeroSprite("hero-run", dir.x < 0);
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
      } else {
        setHeroSprite("hero-idle", player.flipX);
      }
      player.z = player.pos.y;

      // sword rests toward the facing direction between swings
      if (!swinging) {
        swordPivot.angle = lerpAngle(swordPivot.angle, faceAngle() + 35, k.dt() * 14);
      }

      if (bridge.takeTouchAttack()) attack();

      const cx = Math.max(320, Math.min(player.pos.x, WORLD.W * 16 - 320));
      const cy = Math.max(180, Math.min(player.pos.y, WORLD.H * 16 - 180));
      setCam(k.vec2(cx, cy));
    });

    k.onKeyPress("space", attack);
    k.onKeyPress("j", attack);
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
    api.restart = () => k.go("world");
    api.isPaused = () => state.paused;

    window.__arcade = {
      pos: () => ({ x: player.pos.x, y: player.pos.y }),
      score: () => state.score,
      hearts: () => state.hearts,
      fps: () => k.debug.fps(),
      paused: () => state.paused,
      over: () => state.over,
      arrow: () => showArrow,
      mobs: () =>
        k.get("mob").map((m) => ({ x: Math.round(m.pos.x), y: Math.round(m.pos.y), t: m.type })),
    };

    synth.play("start");
    synth.startBgm();
    showBanner("THE LANDING", "safe ground — go make some noise");
  });

  k.onLoad(() => {
    bridge.onReady?.();
    k.go("world");
  });
  return api;
}
