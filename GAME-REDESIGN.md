# Arcade Redesign Brief — "Side-View Slasher" migration

> Implementation prompt for rebuilding the portfolio arcade's **graphics and
> gameplay** on the new asset set, while keeping the **score arcade + global
> leaderboard byte-for-byte consistent**. Hand this whole file to the
> implementation session. Current build lives in `components/game/`
> (engine.js · common.js · arena.js · assets.js · content.js · synth.js ·
> GameMode.jsx · GameLauncher.jsx). Virtual resolution is **640×360, letterbox**.

---

## 0. The one design decision (recorded — override here if you disagree)

**Keep the world top-down; make only the *characters* side-view with
left/right-only facing.** WASD still moves in 8 directions, the floor is still
a baked top-down tilemap, depth is still sorted by `y`. Characters are drawn as
side-view sprites that flip horizontally by the sign of their velocity's x
(vertical-only movement keeps the last horizontal facing). This "top-down
brawler" hybrid (think *Castle Crashers* movement with flip-only sprites) is the
lowest-risk path: the entire bake/collider/camera pipeline survives untouched,
and it reads correctly with these assets.

The alternative — a true side-scroller beat-'em-up with gravity/lanes — would
throw away the map bake, the arena, the camera clamp, and the collider system.
Not recommended. If you want that, this brief does **not** cover it.

---

## 1. Asset inventory (already placed under `public/game/`)

Side-view sheets, **100×100 per frame**, one PNG per animation, character faces
**right** by default (flipX for left). Exact frame counts (measured):

| Character | role | idle | walk | attack1 | attack2 | attack3 | hurt | death |
|-----------|------|:----:|:----:|:-------:|:-------:|:-------:|:----:|:-----:|
| `chars/soldier/` | **player hero** | 6 | 8 | 6 | 6 | **9** | 4 | 4 |
| `chars/orc/`     | enemy | 6 | 8 | 6 | 6 | — | 4 | 4 |
| `chars/demon/`   | enemy | 6 | 8 | 7 | 7 | — | 4 | 4 |
| `chars/blood/`   | enemy (Blood Monster) | 6 | 8 | 8 | 8 | — | 4 | 4 |

- `props/arrow.png` — projectile, single frame 100×100 (faces right).
- `tiles/interiors.png` — LimeZu Modern Interiors, **256×1424** = 16 cols × 89
  rows of 16px tiles (furniture/props/decor).
- `tiles/room_builder.png` — **272×368** = 17 cols × 23 rows of 16px tiles
  (floors + wall auto-tiles).

The **Soldier is the only character with 3 attacks** → he owns the 3-hit melee
combo. Enemies have 2 attacks each → alternating swings. All sheets are the
no-shadow variant; we draw our own ellipse shadow (`addShadow` already exists in
common.js) so the hit-flash tint never touches the shadow.

> **License flags (see `public/game/CREDITS.txt`):** Modern Interiors *free*
> is **non-commercial only** and forbids editing sprites commercially — fine for
> a personal portfolio, but swap to a CC0 tileset (Kenney Tiny Town / Modern
> City) if this ever goes commercial. The Tiny RPG packs shipped **no license
> file** — confirm freeraw's free-tier terms + required credit line on itch.io
> before deploy.

---

## 2. Scale & anchoring (calibrate first — everything depends on it)

The current world is 16px tiles; current entities are ~16px tall. The new frames
are 100×100 with the **character body only ~40–55px tall, centred, with empty
padding and the feet around y≈70–80 of the frame.** So:

1. **Measure the content bounds** of each character's idle frame (trim the
   transparent margin) once, at build time — record the feet-baseline row and
   body height. Do this with a tiny node/canvas script in the scratchpad; don't
   eyeball it.
2. **Scale** each character so its visible body is ~18–22px (roughly
   `scale ≈ 0.38–0.44`). Pick one scale per character so they read consistently
   against 16px tiles; the boss uses a larger scale.
3. **Anchor at the feet**, not the frame box. Use a tuned `k.anchor(vec2(0, a))`
   (a≈0.35–0.5 depending on measured baseline) OR a fixed sprite offset, so
   `pos` sits at the feet for correct depth sort (`z = pos.y`) and shadow
   placement.
4. **Collider is a small foot-box, NOT the 100px frame.** Reuse the current
   pattern (`k.area({ shape: new k.Rect(...) })`) sized ~12–16 × 6–8 px at the
   feet in *scaled* local space. A full-frame hitbox would make everything
   collide from a body-width away.

---

## 3. Animation system (the core new infrastructure)

Today every entity is a single sprite with one looping `"play"` anim, swapped by
`.use(k.sprite(name))`. Replace that with a small **per-entity animation state
machine**.

### 3a. Loading
Two viable approaches — pick per your taste, (B) recommended for the player:

- **(A) One kaplay sprite per sheet.** `k.loadSprite("soldier-walk",
  "/game/chars/soldier/walk.png", { sliceX: 8, anims: { play: { from:0, to:7,
  loop:true, speed } } })`, then switch with `.use(k.sprite("soldier-attack1"))`.
  Closest to the existing `setMobSprite` pattern → least churn for mobs.
- **(B) Composite each character into ONE atlas canvas at boot** (same technique
  as `bakeWorld`): draw all 7/6 sheets into a single canvas row-per-anim,
  `loadSpriteAtlas` with **named anims** (`idle`, `walk`, `attack1`, `attack2`,
  `attack3`, `hurt`, `death`). One texture per character, clean
  `.play("attack1")` calls, fewer GL texture binds.

Write a `loadCharacters(k)` in a new `characters.js` (mirrors
`loadDungeonSprites`) that produces all four rosters. Suggested anim speeds:
idle 6–8 fps, walk 10–12, attack ~14–16 (snappy), hurt ~12, death ~8.

### 3b. State machine
Give each animated entity a `setAnim(name, { loop, onEnd })` helper that:
- no-ops if already in `name`,
- plays it (`loop:false` for attack/hurt/death; `loop:true` for idle/walk),
- for one-shots, fires `onEnd` on completion (kaplay `onAnimEnd` or a `k.wait`
  of `frames/speed`) and returns to `idle`.

Add an `entity.locked` flag: while an attack/hurt/death one-shot is playing,
movement and AI are suppressed and no new anim can start (except death, and
hurt can interrupt attack for hit-stun). IDLE↔WALK is chosen by real
displacement — **reuse the existing "moved > k.dt()*4" check** that already
drives `setMobSprite`.

---

## 4. Player (rewrite in `engine.js`, shared attack logic in `common.js`)

### Movement
- Keep `SPEED = 92`, 8-directional WASD, camera clamp, `z = pos.y` depth sort —
  **unchanged** (feel + score parity).
- Facing collapses to horizontal: `player.flipX = last horizontal input < 0`.
  `state.facing` (the 8-dir vector) is **still kept** — it aims the melee arc and
  the fireball — but the sprite only flips L/R.
- **Delete the sword pivot.** Remove `swordPivot`, the sword child sprite, the
  rest-pose lerp in the movement loop, and the `swordPivot` tween in
  `makeCombat`. Attacks are now baked into the Soldier's attack anims.

### Anim wiring
- Not moving, not attacking → `idle`. Moving → `walk`. Take damage → `hurt`
  (brief lock + existing hit-flash). Death → `death` one-shot then the existing
  game-over.

### Melee = 3-hit combo (NEW mechanic, uses attack1→2→3)
- Left click (`k.onMousePress("left")`, **keep the binding**) advances a chain:
  `attack1 → attack2 → attack3 → reset`. A press during the *cancel window* near
  the end of the current swing queues the next; a press after the window (or a
  lull) restarts at `attack1`.
- Track this on `state.chain` + `state.chainAt` — **separate from the score
  combo** (see §6). The chain drives which anim + hitbox fires.
- Damage is applied on the swing's **hit-frame(s)**, using the existing
  **direct arc check** (`to.unit().dot(dir)` over `k.get("mob")`), not a
  collision object. Escalate per step: attack1/2 = 1 dmg, **attack3 = finisher**
  (2 dmg, wider reach, bigger knockback, `k.shake` bump, optional small AoE).
- The per-swing lock replaces `ATTACK_CD` timing; keep a floor cooldown so
  mashing can't exceed the current fire rate feel.

### Ranged
- **Keep the fireball + mana system exactly** (`FIRE_CD`, `FIRE_COST`,
  `MANA_MAX`, `MANA_REGEN`, Space binding, AoE explode-on-`wall`/`mob`) — it's
  balanced against the leaderboard ceiling. Optional: reskin the projectile to
  `props/arrow.png` instead of the orange circle, or leave the fireball as-is.
  If you switch to an arrow, keep all the numbers identical.

---

## 5. Mobs (rewrite `makeMobFactory` in `common.js`)

### Telegraphed attacks (NEW — the real slasher upgrade)
Today mobs deal **contact damage** via `k.onCollide("player","mob")`. Replace
with readable, dodgeable attacks:
- When a mob is within its attack range and off cooldown → enter **ATTACK**
  state: play the attack anim (windup frames visible), and **apply damage only
  on the hit frame** if the player is still in range/arc; then a recovery lock.
- **Remove the `onCollide("player","mob")` damage** in engine.js/arena.js (or
  reduce it to a tiny chip on body overlap if you want pressure). The hurt path
  into the player stays the same (hearts, flash, `synth.play("hurt")`, knock).
- Alternate `attack1`/`attack2` per mob for variety.

### Per-mob profiles
- **Orc** — melee bruiser: short range, medium windup, 1 dmg.
- **Demon** — 7-frame attacks: longer windup, higher threat; consider a small
  lunge on attack2.
- **Blood Monster** — 8-frame attacks: a fast double-swipe or a short-range
  spit/AoE; squishier but relentless.
- **Boss** — keep the "RAW LIST GOLEM" name-tag concept; map to Demon or Blood
  at a larger scale with slow, heavy, well-telegraphed hits.

### Hurt & death anims
- `hurtMob` plays `hurt` (interrupts attack = hit-stun) alongside the existing
  knockback + squash tween + `floatDamage`.
- On death, play `death` one-shot **then** destroy — but **fire scoring
  immediately** (see §6) so combo timing and score are unchanged; only the
  visual despawn is delayed. Keep the boss tag cleanup on destroy.

### MOB_TYPES remap (preserve every stat)
Keep the five keys `bug / slime / punch / cron / boss` and their **exact
`hp / speed / score / chase` values** — only repoint `sprite`/`idle` to the new
roster (and add per-type `scale`/`tint` to get 5 visual archetypes from 3
sheets). Example mapping: `bug`→orc, `punch`→orc(tinted), `slime`→blood,
`cron`→blood(tinted/scaled), `boss`→demon(large). **Do not change score
numbers** — the leaderboard depends on them.

---

## 6. SCORE ARCADE — consistency contract (DO NOT DRIFT)

Two different "combos" — keep them distinct:
- **Kill-streak score combo** (`state.combo`, `comboMult`, `COMBO_WINDOW`, cap
  4×) → drives score + leaderboard. **UNCHANGED.** New melee chain does **not**
  touch this formula.
- **Attack chain** (§4) → mechanical/visual only, no scoring effect.

Everything below stays byte-for-byte:
- `comboMult`, `MOB_TYPES.*.score`, `floatScore`, kill scoring in
  `engine.js killMob` / `arena.js addScore+killMob`.
- Arena `waveComposition` (`hpMul`/`speedMul`/`scoreMul`), `waveClear` bonus,
  `MOB_CAP`, elite/boss checkpoints, flask(heal)/coin(75) values.
- `/api/leaderboard` (GET/POST), the **quadratic plausibility ceiling**
  `1300·w² + 2000·w + 6000`, name sanitise, per-IP rate limit,
  `ArcadeLeaderboard.jsx`, `onArenaOver` submit + game-over card in GameMode.
- `window.__arcade` debug hooks (`step`, `enterArena`, `wave`, `aliveMobs`,
  `alive`, `pos`, `score`, `hearts`, `fps`, `mobs`) — QA harnesses depend on them.
- 640×360 letterbox, canvas-focus model, touch bridge
  (`takeTouchAttack`/`takeTouchFire`), landscape lock, synth SFX + `music.mp3`,
  `SPEED`/`FIRE_*`/`MANA_*`.

> **⚠ Ceiling re-verification.** If mob HP, attack cadence, or the melee
> finisher changes how fast a wave is cleared, the *theoretical max score per
> wave shifts*. After tuning, re-derive the max run and confirm the quadratic
> ceiling still bounds it (the ceiling once rejected legit deep runs — see the
> leaderboard route comment). Adjust the ceiling only if math proves it too low,
> and re-run `scratchpad/upstash-smoke.mjs`.

---

## 7. Map renovation (`assets.js` — reskin, don't rebuild)

Keep the **entire bake pipeline** (canvas stamp passes + `mergeColliders` +
monument spots + arena room). Change only the tile source and picks:

- Swap `terrain.png` → `room_builder.png` (floors + wall auto-tiles) and
  `interiors.png` (furniture/decor). Note the new sheet strides: these are
  **16px tiles with NO 1px gutter** (unlike Kenney's `K=17`) — set the stamp
  stride to 16 and re-pick tile coords.
- Rebuild `TER` + `REGION_STYLE` against the new sheets: each story region
  becomes a themed **interior room** (e.g. Landing = warm lobby, BeamHive =
  modern office, Nexus = teal-lit lab…), tinted to the "Deep Water" palette
  washes already in `REGION_STYLE`.
- `bakeArena` becomes a modern room: `room_builder` floor + wall ring, and
  `interiors` furniture as the four cover "pillars" (colliders unchanged).
- Colliders/monument logic are byte-identical — only the *drawn* tiles change,
  so movement/QA geometry is preserved.

Watch: LimeZu wall tiles are *tall* (a wall is a 16px cap over a 16px base in
the source) — you may stamp two rows for a wall, but keep the **collider** on the
single logical wall cell so the collision map matches today's.

---

## 8. Migration plan (phased, mirrors how the arena was built)

0. **Assets placed + credited.** ✅ (done: `public/game/chars|props|tiles`, CREDITS updated)
1. **`characters.js` loader + `setAnim` state-machine helper.** Verify by
   rendering all four rosters cycling every anim on a scratch screen.
2. **Player rewrite** (`engine.js` + shared `makeCombat`): Soldier anim SM,
   3-hit chain, hurt/death, delete sword pivot. Keep movement/camera/facing arc
   and all scoring identical.
3. **Mob rewrite** (`common.js makeMobFactory`): anim SM, telegraphed attacks,
   hurt/death anims, move damage off `onCollide` to hit-frames, MOB_TYPES remap
   (stats preserved).
4. **Map reskin** (`assets.js`): interiors/room_builder `TER` + `REGION_STYLE`,
   16px stride, rebuild `bakeWorld` + `bakeArena` picks. Colliders unchanged.
5. **QA + re-tune** via the puppeteer `window.__arcade` harness (scratchpad
   `game-qa*.js` pattern): 60fps target (GPU flags **on**, never `--disable-gpu`),
   score parity, full die→submit→board round-trip, **re-verify the ceiling**.
6. **Remove legacy**: delete `dungeon.png`, `terrain.png`, `atlas0x72.js`, and
   `loadDungeonSprites`/`SHEET_SPRITES` once nothing imports them; drop the
   legacy section from CREDITS. Commit.

Per-phase safety: the story-mode "fingerprint" and arena were previously
regression-checked frame-identically — keep that discipline; a phase that
changes visuals but must not change *scoring* should be diffed against a recorded
score trace, not pixels.

---

## 9. Optional complementary assets (all should be verified CC0 / permissive)

Same-style, **drop-in** because they share freeraw's 100×100 side-view format
and `Idle/Walk/Attack/Hurt/Death` naming:

- **More freeraw "Tiny RPG Character" packs** — extra monsters (Skeleton,
  Werewolf, Minotaur, Fungus, Golem…) for real wave variety, and an alt hero
  (Knight / **Bowman** — pairs perfectly with the bundled `arrow.png` for a true
  ranged character-select). These slot straight into `characters.js`.
- **Slash / impact / explosion VFX spritesheets** (CodeManu / Ansimuz free pixel
  FX, or Kenney particle pack) — real slash arcs, hit sparks, and a punchier
  fireball beyond the current synth `poof`. Biggest single "feels like a slasher"
  upgrade.
- **Map fallback if the LimeZu license is a concern** — Kenney *Tiny Town* /
  *Modern City* / *Roguelike Modern City* (CC0), or a CC0 interiors set.
- **Meatier SFX (optional)** — Kenney *RPG / Impact* audio to layer under the
  synth slashes if they feel thin; music + synth otherwise stay.
- **HUD** — Kenney UI pack if you want to reskin hearts/mana/leaderboard chrome
  (keep it in the "Deep Water" palette).

---

## 10. Risks / watch-list

- **Texture memory / draw calls**: ~27 character sheets + tile atlases. Prefer
  the composited-atlas approach (§3a-B) and reuse tinted archetypes to keep GL
  texture binds low. Confirm 60fps in headless with GPU flags on.
- **Anchor/scale drift**: a wrong feet-baseline makes characters float or sink
  and breaks depth sort — calibrate §2 before wiring gameplay.
- **Contact-damage removal**: once mobs only hurt via telegraphed attacks, early
  waves can feel toothless — tune windup/range/cooldown, don't just delete.
- **Ceiling drift**: any balance change → re-verify §6's quadratic bound.
- **License**: resolve the Modern Interiors non-commercial flag before any
  commercial framing of the site.
