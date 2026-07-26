/*
  common.js — the parts of the arcade that both the story overworld
  (engine.js) and the endless arena (arena.js) share, factored out so the
  two scenes run identical player control, mob AI, combat, HUD and scoring
  instead of two drifting copies.

  Redesign (side-view slasher): characters are the Tiny RPG sheets loaded by
  characters.js as multi-anim sprites. The player is a 3-hit-combo soldier;
  mobs telegraph real attacks (windup → hit-frame) and play hurt/death anims.
  The SCORE model (kill-streak comboMult, MOB_TYPES score values) is unchanged
  so the global leaderboard stays consistent.

  Everything here is a factory taking the live KAPLAY handle `k`, the synth, a
  `kit` of palette+helpers, and a `deps` object holding the scene's mutable
  `state`/`player` (passed by reference — mutated, never reassigned).
*/

import { CHAR_FRAMES, CHAR_META, COMBOS, charAnchor, setAnim, curAnim, animDuration } from "./characters";

/* ---- tunables ---- */
export const SPEED = 92;
export const ATTACK_CD = 0.16; // floor between swings (anim length usually dominates)
export const COMBO_WINDOW = 3; // KILL-streak window (score multiplier) — unchanged
export const CHAIN_WINDOW = 0.7; // MELEE-chain window (attack1→2→3) — mechanical only

export const FIRE_CD = 0.4;
export const FIRE_COST = 34;
export const MANA_MAX = 100;
export const MANA_REGEN = 20; // points per second

/*
  Mob archetypes. hp / speed / score / chase are UNCHANGED from the original
  (the leaderboard depends on the score values). New fields are visual/behaviour
  only: `char` picks the side-view sprite, `scale`/`tint` differentiate variants
  from the 3 monster sheets, and atk* drive the telegraphed attack.
*/
export const MOB_TYPES = {
  bug: { char: "orc", hp: 1, speed: 55, score: 50, chase: 110,
    scale: 0.9, atkRange: 20, atkHit: 26, atkCd: 1.1, hitFrac: 0.5 },
  slime: { char: "blood", hp: 2, speed: 34, score: 100, chase: 120,
    scale: 0.95, atkRange: 18, atkHit: 24, atkCd: 1.3, hitFrac: 0.5 },
  punch: { char: "demon", hp: 2, speed: 46, score: 150, chase: 130,
    scale: 1.0, atkRange: 24, atkHit: 30, atkCd: 1.4, hitFrac: 0.55 },
  cron: { char: "blood", hp: 3, speed: 26, score: 200, chase: 130,
    scale: 1.12, tint: [170, 220, 225], atkRange: 20, atkHit: 27, atkCd: 1.2, hitFrac: 0.5 },
  boss: { char: "demon", hp: 20, speed: 22, score: 500, chase: 170,
    scale: 1.7, tint: [255, 165, 150], atkRange: 34, atkHit: 46, atkCd: 1.6, hitFrac: 0.55 },
};

// combo multiplier: +0.5x per kill in the window, capped at 4x (unchanged)
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
  // "GamePixel" is the CSS @font-face (globals.css) the DOM already uses, so
  // it's loaded reliably before the game boots — unlike a canvas-only FontFace,
  // which raced and left blank/black-box labels. See GameMode's font preload.
  const ptext = (str, size = 8) => k.text(str, { size, font: "GamePixel" });

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
  ---- player factory ----
  Builds the soldier + its shadow. The scene owns movement/camera/input; combat
  (makeCombat) owns the attack chain + hurt/death anims. Returns the entity.
*/
export function makePlayer(k, kit, spawn, hero = "soldier") {
  const { addShadow } = kit;
  const meta = CHAR_META[hero] || CHAR_META.soldier;
  const player = k.add([
    k.sprite(hero),
    k.pos(spawn.x, spawn.y),
    k.area({ shape: new k.Rect(k.vec2(-6, -9), 12, 9) }),
    k.body(),
    k.anchor(charAnchor(k, hero)),
    k.scale(meta.scale),
    k.z(10),
    k.opacity(1),
    "player",
  ]);
  player.hero = hero;
  setAnim(player, "idle", { force: true });
  addShadow(player, 5.5);
  return player;
}

/*
  ---- mob factory ----
  spawnMob(sp) builds one mob + its AI. sp = { type, x, y } with optional
  { hpMul, speedMul, scoreMul }. deps = { state, player, leash, onPlayerHit }:
    - leash true  (story): mobs tether to homePos (~150px) and only chase
      inside cfg.chase — a cleared region stays quiet.
    - leash false (arena): no tether and infinite chase.
    - onPlayerHit(mob): the scene's player-damage routine, called on a mob
      attack's hit-frame (replaces the old contact-damage collide).
*/
export function makeMobFactory(k, synth, kit, deps) {
  const { ORANGE, ptext, addShadow } = kit;
  const { state, player, leash = true, onPlayerHit } = deps;

  return function spawnMob(sp) {
    const cfg = MOB_TYPES[sp.type];
    const char = cfg.char;
    const isBoss = sp.type === "boss";
    const chaseR = leash ? cfg.chase : 9999;
    const hp = Math.max(1, Math.round(cfg.hp * (sp.hpMul || 1)));
    const speedBase = cfg.speed * (sp.speedMul || 1);
    const scoreVal = Math.round(cfg.score * (sp.scoreMul || 1));
    const sc = cfg.scale || 1;

    const comps = [
      k.sprite(char),
      k.pos(sp.x * 16 + 8, sp.y * 16 + 14),
      k.area({ shape: new k.Rect(k.vec2(-6 * sc, -8 * sc), 12 * sc, 8 * sc) }),
      k.body(),
      k.anchor(charAnchor(k, char)),
      k.scale(sc),
      k.z(10),
      k.opacity(1),
      k.offscreen({ hide: true, distance: 120 }),
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
        busy: false, // attacking or in hit-stun → rooted
        dying: false,
        nextAtk: 0,
        _swingId: 0,
      },
    ];
    if (cfg.tint) comps.push(k.color(cfg.tint[0], cfg.tint[1], cfg.tint[2]));
    const mob = k.add(comps);
    setAnim(mob, "idle", { force: true });
    addShadow(mob, (isBoss ? 11 : 5) * sc);

    if (isBoss) {
      const tagBg = k.add([
        k.rect(15 * 8 + 8, 12), k.pos(mob.pos), k.anchor("center"),
        k.color(0, 21, 36), k.opacity(0.65), k.z(3000),
      ]);
      const tag = k.add([
        ptext("RAW LIST GOLEM"), k.pos(mob.pos), k.anchor("center"),
        k.color(ORANGE), k.z(3001),
      ]);
      const sync = () => {
        tagBg.pos = mob.pos.sub(0, 52);
        tag.pos = tagBg.pos;
      };
      sync();
      mob.onUpdate(sync);
      mob.onDestroy(() => {
        tagBg.destroy();
        tag.destroy();
      });
    }

    mob.prevPos = mob.pos.clone();
    mob.stuckT = 0;
    mob.blockedDir = null;

    /* telegraphed attack: windup anim, damage on the hit-frame if the player
       is still in range, then a recovery cooldown */
    function startAttack() {
      mob.busy = true;
      mob.flipX = player.pos.x < mob.pos.x;
      const which = Math.random() < 0.5 ? "attack1" : "attack2";
      const dur = animDuration(which, CHAR_FRAMES[char][which]);
      const id = ++mob._swingId;
      synth.play("slash");
      setAnim(mob, which, {
        force: true,
        onEnd: () => {
          if (mob._swingId === id) {
            mob.busy = false;
            mob.nextAtk = k.time() + cfg.atkCd;
          }
        },
      });
      k.wait(dur * (cfg.hitFrac || 0.5), () => {
        if (!mob.exists() || mob.dying || mob._swingId !== id) return; // interrupted
        if (player.pos.dist(mob.pos) <= cfg.atkHit) onPlayerHit && onPlayerHit(mob);
      });
    }

    // taking a hit: interrupt any swing (bump _swingId) + play hurt one-shot
    mob.playHurt = () => {
      if (mob.dying) return;
      const id = ++mob._swingId;
      mob.busy = true;
      setAnim(mob, "hurt", {
        force: true,
        onEnd: () => {
          if (mob._swingId === id) {
            mob.busy = false;
            mob.nextAtk = Math.max(mob.nextAtk, k.time() + 0.25);
          }
        },
      });
    };

    // death: cancel pending hits, leave the "mob" set (so nothing hits/counts
    // it again), play death, then destroy
    mob.die = (after) => {
      if (mob.dying) return;
      mob.dying = true;
      mob._swingId++;
      mob.untag("mob");
      const dur = animDuration("death", CHAR_FRAMES[char].death);
      setAnim(mob, "death", {
        force: true,
        onEnd: () => {
          mob.destroy();
          after && after();
        },
      });
      // safety net if onEnd is missed
      k.wait(dur + 0.4, () => {
        if (mob.exists()) {
          mob.destroy();
          after && after();
        }
      });
    };

    mob.onUpdate(() => {
      if (state.paused || state.over || mob.dying) return;
      mob.z = mob.pos.y; // depth sort
      const moved = mob.pos.dist(mob.prevPos);
      mob.prevPos = mob.pos.clone();

      // knockback wins briefly (also carries through hit-stun)
      if (mob.knock.len() > 1) {
        mob.move(mob.knock);
        mob.knock = mob.knock.scale(1 - Math.min(k.dt() * 10, 0.9));
        return;
      }
      if (mob.busy) return; // attacking / hit-stun → rooted, anim owns the sprite

      const d = player.pos.dist(mob.pos);
      if (d > 420) return; // sleep far away

      // in range + off cooldown → attack
      if (k.time() >= mob.nextAtk && d <= cfg.atkRange) {
        startAttack();
        return;
      }

      if (leash && mob.pos.dist(mob.homePos) > 150) {
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

      // walk when actually displacing, else idle
      setAnim(mob, moved > k.dt() * 4 ? "walk" : "idle");
    });

    sp.mob = mob;
    return mob;
  };
}

/*
  ---- combat ----
  Owns the player's melee 3-hit chain, fireball, and the player's hurt/death
  anims. deps = { state, player, onMobDeath }. onMobDeath(mob) is the scene's
  killMob (scoring + progression/wave logic).

  Exposes:
    attack()          — advance the melee chain (attack1→2→3)
    fireball()        — ranged, spends mana, AoE on impact
    tickAnim(moving)  — call every frame from the movement loop; sets walk/idle
                        when the player isn't mid-swing/hit (and flips to face)
    playerHurt()      — play the hurt one-shot (called from the damage routine)
    playerDeath(cb)   — play death, then cb() (game over)
    hurtMob(mob,n,from)
    isBusy()          — a one-shot (attack/hurt) is playing
*/
export function makeCombat(k, synth, kit, deps) {
  const { ORANGE, EMBER, poof } = kit;
  const { state, player, onMobDeath, hero = "soldier" } = deps;
  const combo = COMBOS[hero] || COMBOS.soldier;
  const F = CHAR_FRAMES[hero] || CHAR_FRAMES.soldier;

  let swing = null; // { start, dur, step, dir, isFinisher } | null
  let hurtUntil = 0;
  let lunge = null; // { dir, until, speed } — collision-safe forward scoot
  const isBusy = () => swing !== null || k.time() < hurtUntil;

  // bright spark burst where a hit connects
  function hitSpark(at, colorHex) {
    const col = k.Color.fromHex(colorHex);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      k.add([
        k.rect(2, 2), k.pos(at), k.anchor("center"), k.color(col), k.z(1700),
        k.move(k.vec2(Math.cos(a), Math.sin(a)), 60 + Math.random() * 70),
        k.opacity(1), k.lifespan(0.05, { fade: 0.18 }),
      ]);
    }
  }

  // a crescent of bright dots swept in the facing direction — the visible slash
  function slashFx(dir, step, colorHex) {
    const base = Math.atan2(dir.y, dir.x);
    const spread = step.arc < 0 ? 2.4 : 1.6; // finishers sweep wider
    const R = step.reach * 0.55;
    const col = k.Color.fromHex(colorHex);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * spread;
      const p = player.pos.sub(0, 10).add(k.vec2(Math.cos(a), Math.sin(a)).scale(R));
      k.add([
        k.rect(3, 3), k.pos(p), k.anchor("center"), k.color(col), k.z(1600),
        k.opacity(0.9), k.lifespan(0.05, { fade: 0.12 }),
      ]);
    }
  }

  function hurtMob(mob, amount, fromPos, knockAmt, sparkHex) {
    if (mob.dying) return;
    mob.hp -= amount;
    const impulse = knockAmt != null ? knockAmt : amount >= 2 ? 210 : 190;
    mob.knock = mob.pos.sub(fromPos).unit().scale(impulse);
    const s0 = mob.scale.x;
    k.tween(s0 * 1.24, s0, 0.14, (v) => mob.scaleTo(v));
    floatDamage(k, kit, amount, mob.pos.sub(0, 4));
    hitSpark(mob.pos.sub(0, 6), sparkHex || "#ffecd1");
    if (mob.hp <= 0) onMobDeath(mob);
    else mob.playHurt && mob.playHurt();
  }

  // apply one combo step's damage — direct arc check (a collision hitbox proved
  // unreliable). Each character's steps carry their own reach/dmg/knock/arc.
  function applySwing(step, dir, isFinisher) {
    if (state.over) return;
    let landed = false;
    for (const mob of k.get("mob")) {
      const to = mob.pos.sub(player.pos);
      const d = to.len();
      const r = step.reach + (mob.type === "boss" ? 16 : 0);
      if (d > r) continue;
      if (d > 16 && to.unit().dot(dir) < step.arc) continue;
      hurtMob(mob, step.dmg, player.pos, step.knock, combo.slash);
      landed = true;
    }
    if (landed) {
      synth.play("hit");
      k.shake(step.shake);
    } else if (isFinisher) {
      k.shake(Math.min(step.shake, 3));
    }
  }

  function attack() {
    const now = k.time();
    if (state.paused || state.over) return;
    if (now < state.attackAt + combo.cd) return;
    // mid-swing: only cancel into the next hit late in the current anim
    if (swing && now < swing.start + swing.dur * 0.55) return;
    if (now < hurtUntil) return;

    // advance or reset the melee chain (distinct from the kill-streak score combo)
    const chained =
      state.chain > 0 && state.chain < combo.steps.length && now - state.chainAt <= combo.chainWindow;
    state.chain = chained ? state.chain + 1 : 1;
    state.chainAt = now;
    state.attackAt = now;

    const step = combo.steps[state.chain - 1];
    const isFinisher = state.chain >= combo.steps.length;
    const dur = animDuration(step.anim, F[step.anim]);
    const dir = state.facing.unit();
    if (state.facing.x !== 0) player.flipX = state.facing.x < 0; // keep facing on vertical swings
    swing = { start: now, dur, step, dir, isFinisher };
    synth.play(isFinisher ? "explosion" : "slash");

    // weighty forward lunge, applied collision-safe in tickAnim over the next beat
    if (step.lunge) {
      const t = Math.min(dur * 0.6, 0.16);
      lunge = { dir, until: now + t, speed: step.lunge / t };
    }
    slashFx(dir, step, combo.slash);

    setAnim(player, step.anim, {
      force: true,
      onEnd: () => {
        if (swing && swing.start === now) {
          swing = null;
          if (isFinisher) state.chain = 0; // finisher closes the chain
        }
      },
    });
    k.wait(dur * step.hitFrac, () => applySwing(step, dir, isFinisher));
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

  // called every frame from the movement loop. Applies an active lunge (via
  // move, so walls still block it), then — when a one-shot isn't owning the
  // sprite — shows walk/idle and flips toward travel.
  function tickAnim(moving, flipX) {
    if (lunge) {
      if (k.time() < lunge.until) player.move(lunge.dir.scale(lunge.speed));
      else lunge = null;
    }
    if (isBusy()) return;
    if (moving && flipX !== undefined) player.flipX = flipX;
    setAnim(player, moving ? "walk" : "idle");
  }

  function playerHurt() {
    if (state.over) return;
    const dur = animDuration("hurt", F.hurt);
    hurtUntil = k.time() + dur;
    swing = null; // a hit interrupts a swing
    setAnim(player, "hurt", { force: true });
  }

  function playerDeath(cb) {
    swing = null;
    hurtUntil = 0;
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      cb && cb();
    };
    setAnim(player, "death", { force: true, onEnd: fire });
    // safety: fire once even if onEnd is missed
    k.wait(animDuration("death", F.death) + 0.3, fire);
  }

  return { attack, fireball, explode, hurtMob, tickAnim, playerHurt, playerDeath, isBusy };
}

/*
  ---- pickups ----
  Flask heals a heart (cap 3), coin is score. deps = { state, refreshHUD }.
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
