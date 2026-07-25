/*
  common.js — the parts of the arcade that both the story overworld
  (engine.js) and the endless arena (arena.js) share, factored out so the
  two scenes run identical mob AI, combat, HUD and scoring instead of two
  drifting copies.

  Everything here is a factory: it takes the live KAPLAY handle `k`, the
  synth, a `kit` of palette+helpers, and a small `deps` object holding the
  scene's mutable `state`/`player` (passed by reference — never reassigned,
  only mutated — so the closures read live values). Nothing here knows about
  progression, regions, monuments or waves; those stay scene-side.
*/

/* ---- tunables (identical to the originals in engine.js) ---- */
export const SPEED = 92;
export const ATTACK_CD = 0.3;
export const COMBO_WINDOW = 3;

export const FIRE_CD = 0.4;
export const FIRE_COST = 34;
export const MANA_MAX = 100;
export const MANA_REGEN = 20; // points per second

/* idle: the standing anim shown when a mob is paused or pressed against a
   wall (slugs only have the one anim — it reads as idling anyway) */
export const MOB_TYPES = {
  bug: { sprite: "goblin", idle: "goblin-idle", hp: 1, speed: 55, score: 50, chase: 110 },
  slime: { sprite: "slug", idle: "slug", hp: 2, speed: 34, score: 100, chase: 120 },
  punch: { sprite: "zombie", idle: "zombie-idle", hp: 2, speed: 46, score: 150, chase: 130 },
  cron: { sprite: "chort", idle: "chort-idle", hp: 3, speed: 26, score: 200, chase: 130 },
  boss: { sprite: "demon", idle: "demon-idle", hp: 20, speed: 22, score: 500, chase: 170 },
};

// combo multiplier: +0.5x per kill in the window, capped at 4x
export function comboMult(combo) {
  return Math.min(1 + 0.5 * (combo - 1), 4);
}

/* ---- palette + tiny drawing helpers ---- */
export function makeKit(k) {
  const hex = (h) => k.Color.fromHex(h);
  const CREAM = hex("#ffecd1");
  const ORANGE = hex("#ff7d00");
  const INK = hex("#001524");
  const MANA_ON = hex("#2f8291");
  const MANA_OFF = hex("#0c3f4a");
  const EMBER = hex("#ffa64d");
  const setCam = (v) => (k.setCamPos ? k.setCamPos(v) : k.camPos(v));

  // all in-canvas text uses the pixel font at 8px multiples (it's an
  // 8x8-grid face; other sizes turn to mush under crisp upscaling)
  const ptext = (str, size = 8) => k.text(str, { size, font: "pixel" });

  function lerpAngle(a, b, t) {
    const d = ((b - a + 540) % 360) - 180;
    return a + d * Math.min(t, 1);
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

  // shadows: standalone followers kept under the entities
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

  return { hex, CREAM, ORANGE, INK, MANA_ON, MANA_OFF, EMBER, setCam, ptext, lerpAngle, poof, addShadow };
}

/* ---- HUD widgets shared by both modes: hearts, mana bar, score, combo,
   the centered banner, and the fps readout. Scene-specific lines (story's
   objective, arena's wave counter) are built by the scene, not here. ---- */
export function makeHud(k, kit) {
  const { CREAM, ORANGE, INK, MANA_ON, MANA_OFF, ptext } = kit;

  const heartsUI = [0, 1, 2].map((i) =>
    k.add([k.sprite("heart-full"), k.pos(8 + i * 15, 7), k.fixed(), k.z(100)])
  );
  // mana bar to the right of the hearts (teal = fireball fuel)
  k.add([k.rect(52, 8), k.pos(58, 9), k.fixed(), k.z(99), k.color(INK), k.opacity(0.55)]);
  const manaFill = k.add([
    k.rect(48, 4), k.pos(60, 11), k.fixed(), k.z(100), k.color(MANA_ON),
  ]);
  const scoreUI = k.add([
    ptext("SCORE 0"), k.pos(8, 26), k.fixed(), k.z(100), k.color(CREAM),
  ]);
  const comboUI = k.add([
    ptext(""), k.pos(8, 54), k.fixed(), k.z(100), k.color(ORANGE),
  ]);
  const bannerUI = k.add([
    ptext("", 16), k.pos(320, 40), k.anchor("center"), k.fixed(), k.z(100),
    k.color(CREAM), k.opacity(0),
  ]);
  const bannerSubUI = k.add([
    ptext(""), k.pos(320, 58), k.anchor("center"), k.fixed(), k.z(100),
    k.color(ORANGE), k.opacity(0),
  ]);
  const fpsUI = k.add([
    ptext(""), k.pos(632, 352), k.anchor("botright"), k.fixed(), k.z(100),
    k.color(CREAM), k.opacity(0.35),
  ]);
  k.loop(0.5, () => (fpsUI.text = `${k.debug.fps()} FPS`));

  const heartState = [true, true, true];
  function refreshHearts(hearts) {
    heartsUI.forEach((h, i) => {
      const full = i < hearts;
      if (heartState[i] !== full) {
        h.use(k.sprite(full ? "heart-full" : "heart-empty"));
        heartState[i] = full;
      }
    });
  }
  // the shared row of the HUD: hearts + score + combo. The scene calls this,
  // then updates its own extra lines (objective / best / wave).
  function refreshCore(state) {
    refreshHearts(state.hearts);
    scoreUI.text = `SCORE ${state.score}`;
    comboUI.text = state.combo > 1 ? `COMBO x${comboMult(state.combo).toFixed(1)}` : "";
  }

  function updateMana(mana) {
    manaFill.width = Math.max(0, 48 * (mana / MANA_MAX));
    manaFill.color = mana >= FIRE_COST ? MANA_ON : MANA_OFF;
  }

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

  return { refreshCore, refreshHearts, updateMana, showBanner, els: { heartsUI, manaFill, scoreUI, comboUI, bannerUI, bannerSubUI, fpsUI } };
}

/* ---- floating +score popup, shown when a mob dies ---- */
export function floatScore(k, kit, gained, at, hot) {
  const { CREAM, ORANGE, ptext } = kit;
  k.add([
    ptext(`+${gained}`),
    k.pos(at), k.anchor("center"), k.z(2000),
    k.color(hot ? ORANGE : CREAM),
    k.move(k.vec2(0, -1), 34),
    k.opacity(1), k.lifespan(0.15, { fade: 0.5 }),
  ]);
}

/* ---- floating damage number, shown on EVERY hit (not just the kill).
   Fireball hits (3) read hot/orange and a touch larger; melee (1) is a
   subtler cream. A little x-jitter keeps rapid hits from stacking. ---- */
export function floatDamage(k, kit, amount, at) {
  const { CREAM, EMBER, ptext } = kit;
  const big = amount >= 3;
  k.add([
    ptext(`${amount}`),
    k.pos(at.add(k.vec2(Math.random() * 8 - 4, -4))),
    k.anchor("center"),
    k.z(1900),
    k.color(big ? EMBER : CREAM),
    k.scale(big ? 1 : 0.85),
    k.move(k.vec2(Math.random() * 16 - 8, -1), 42),
    k.opacity(0.95),
    k.lifespan(0.12, { fade: 0.42 }),
  ]);
}

/*
  ---- mob factory ----
  spawnMob(sp) builds one mob + its AI. sp = { type, x, y } with optional
  { hpMul, speedMul, scoreMul }. deps = { state, player, leash }:
    - leash true  (story): mobs tether to their homePos (~150px) and only
      chase inside cfg.chase — a cleared region stays quiet.
    - leash false (arena): no tether and an effectively infinite chase, so
      wave mobs commit to the player across the whole arena.
*/
export function makeMobFactory(k, kit, deps) {
  const { ORANGE, ptext, addShadow } = kit;
  const { state, player, leash = true } = deps;

  return function spawnMob(sp) {
    const cfg = MOB_TYPES[sp.type];
    const isBoss = sp.type === "boss";
    const chaseR = leash ? cfg.chase : 9999;
    const hp = Math.max(1, Math.round(cfg.hp * (sp.hpMul || 1)));
    const speedBase = cfg.speed * (sp.speedMul || 1);
    const scoreVal = Math.round(cfg.score * (sp.scoreMul || 1));

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
        hp,
        speedBase,
        chaseR,
        scoreVal,
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
      } else if (leash && mob.pos.dist(mob.homePos) > 150) {
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
  };
}

/*
  ---- combat ----
  deps = { state, player, swordPivot, onMobDeath }. onMobDeath(mob) is the
  scene's killMob (scoring + progression/wave logic). isSwinging() lets the
  scene's movement loop know whether to reclaim the sword rest pose.
*/
export function makeCombat(k, synth, kit, deps) {
  const { ORANGE, EMBER, poof } = kit;
  const { state, player, swordPivot, onMobDeath } = deps;
  let swinging = false;

  const faceAngle = () =>
    Math.atan2(state.facing.y, state.facing.x) * (180 / Math.PI) + 90;

  function hurtMob(mob, amount, fromPos) {
    mob.hp -= amount;
    mob.knock = mob.pos.sub(fromPos).unit().scale(amount >= 2 ? 210 : 190);
    const s0 = mob.scale.x;
    k.tween(s0 * 1.22, s0, 0.15, (v) => mob.scaleTo(v));
    floatDamage(k, kit, amount, mob.pos.sub(0, 4)); // per-hit damage number
    if (mob.hp <= 0) onMobDeath(mob);
  }

  // melee — sweeps the sword arc in the facing dir
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
    let landed = false;
    for (const mob of k.get("mob")) {
      const to = mob.pos.sub(player.pos);
      const reach = 46 + (mob.type === "boss" ? 16 : 0);
      const d = to.len();
      if (d > reach) continue;
      // must be roughly in front, unless point-blank (16 ≈ contact range,
      // so a mob chewing on your back is always hittable)
      if (d > 16 && to.unit().dot(dir) < 0.2) continue;
      hurtMob(mob, 1, player.pos);
      landed = true;
    }
    if (landed) {
      synth.play("hit");
      k.shake(3);
    }
  }

  // fireball — ranged, spends mana, bursts on impact with AoE
  function fireball() {
    const now = k.time();
    if (state.paused || state.over || now - state.castAt < FIRE_CD) return;
    if (state.mana < FIRE_COST) {
      synth.play("nomana");
      return;
    }
    state.mana -= FIRE_COST;
    state.castAt = now;
    synth.play("fireball");

    const dir = state.facing.unit();
    const ball = k.add([
      k.circle(4),
      k.pos(player.pos.sub(0, 10).add(dir.scale(12))),
      k.anchor("center"),
      k.color(ORANGE),
      k.area({ shape: new k.Rect(k.vec2(-4, -4), 8, 8) }),
      k.z(1200),
      "fireball",
      { dir, born: now },
    ]);
    ball.add([k.circle(7), k.anchor("center"), k.color(ORANGE), k.opacity(0.3)]);
    ball.onUpdate(() => {
      if (state.paused || state.over) return;
      ball.move(dir.scale(240));
      k.add([
        k.circle(3), k.pos(ball.pos), k.anchor("center"),
        k.color(EMBER), k.opacity(0.5), k.z(1150),
        k.lifespan(0.02, { fade: 0.22 }),
      ]);
      if (k.time() - ball.born > 1.2) {
        explode(ball.pos);
        ball.destroy();
      }
    });
  }

  function explode(pos) {
    synth.play("explosion");
    k.shake(5);
    poof(pos, "#ff7d00", 14);
    const ring = k.add([
      k.circle(6), k.pos(pos), k.anchor("center"),
      k.color(ORANGE), k.opacity(0.6), k.z(1300),
    ]);
    k.tween(6, 30, 0.22, (r) => (ring.radius = r), k.easings.easeOutQuad);
    k.tween(0.6, 0, 0.28, (o) => (ring.opacity = o)).then(() => ring.destroy());
    for (const mob of k.get("mob")) {
      if (mob.pos.dist(pos) <= 30) hurtMob(mob, 3, pos);
    }
  }

  k.onCollide("fireball", "mob", (ball) => {
    if (!ball.exists()) return;
    explode(ball.pos);
    ball.destroy();
  });
  k.onCollide("fireball", "wall", (ball) => {
    if (!ball.exists()) return;
    explode(ball.pos);
    ball.destroy();
  });

  return { attack, fireball, explode, hurtMob, isSwinging: () => swinging };
}

/*
  ---- pickups ----
  Flask heals a heart (cap 3), coin is score. deps = { state, refreshHUD }.
  refreshHUD is the scene's HUD-refresh so the hearts/score update on collect.
*/
export function makePickups(k, kit, synth, deps) {
  const { poof } = kit;
  const { state, refreshHUD } = deps;

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

  return { dropPickup };
}
