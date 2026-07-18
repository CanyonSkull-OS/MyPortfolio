# Omer's Arcade — Game Mode Design

Turning the portfolio into a playable 2D arcade adventure. The classic
"Deep Water" scroll site stays; the game is the primary experience behind a
**Press Start** toggle. This doc is the plan; the implementation lives in
`components/game/`.

---

## 1. Concept

**"The Automation Knight"** — a top-down pixel-art arcade world. You play
Omer, sword in hand, roaming a single connected overworld split into
regions that each tell one chapter of the real portfolio: the game-dev
origins, the Atompoint internship, the BeamHive engine, the n8n skill core.
Mobs themed as the actual enemies of automation (legacy bugs, missed
punches, cold leads, tangled crons) spawn in each region. Killing them
scores points with a combo multiplier. Monuments in each region open
readable cards with the real achievements, pulled from `lib/data.js` —
the same single source of truth the scroll site renders.

Design pillars:

1. **The portfolio is the content.** Every region, monument, and mob name
   maps to something true from the resume. No filler lore.
2. **Arcade, not RPG.** Instant movement, one attack button, score chase,
   3-heart survival. A full run reads in ~3 minutes.
3. **On-palette.** Ink / teal / cream / orange / rust only — the game
   looks like the site put on pixel armor.
4. **Zero-cost until played.** KAPLAY and every asset loads lazily on
   Press Start. The scroll site's bundle does not grow.

---

## 2. Architecture

- **Toggle flow:** Hero gains a `▶ Press Start` CTA (plus Esc / on-screen
  button to exit). `GameLauncher` (client) listens for a `game:launch`
  window event, locks Lenis scroll, and mounts `GameMode` full-screen at
  `z-[100]`. Exit unlocks scroll and unmounts (KAPLAY `quit()` tears the
  loop down).
- **Engine:** KAPLAY 3001 (`global: false`, own canvas), internal
  resolution **640×360**, `letterbox + stretch + crisp` for chunky pixels
  at any screen size.
- **No binary assets.** Sprites are authored as pixel-string matrices and
  baked to data-URL sprite sheets at boot (`sprites.js`). Tiles are
  procedurally speckled 16×16 canvases. All audio is synthesized WebAudio
  (`synth.js`). The repo stays free of image/audio files and the static
  guarantee holds.

### File map

```
components/game/
  GameLauncher.jsx   — Press Start listener, scroll lock, lazy mount
  GameMode.jsx       — full-screen overlay: canvas + DOM HUD (panel cards,
                       game-over, mute, exit, touch controls)
  engine.js          — buildGame(k, synth, bridge): scenes, player, mobs,
                       combat, camera, spawners, region logic
  sprites.js         — pixel-string → sprite-sheet factory + tile baker
  synth.js           — WebAudio SFX + tiny chiptune loop
  content.js         — world grid builder, region defs, monument copy
                       (imports lib/data.js)
design.md            — this plan
```

---

## 3. The world

One 64×44-tile map (16px tiles → 1024×704 world units), water ring border,
rock walls between regions with door gaps. Built programmatically in
`content.js` (rect fills + carved paths + seeded decor), not hand-typed
ASCII.

| Region (zone banner)      | Where   | Theme / floor                | Mobs                          | Monuments (real content)                                   |
| ------------------------- | ------- | ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| **The Landing**           | SW      | cream flagstones             | none (safe zone)              | Controls sign · BM Accounting cabinet · Contact obelisk    |
| **Pixel Origins · 2024**  | NW      | dark ink-teal "CRT" floor    | Legacy Bugs (fast, 1 HP)      | Journey ch.1 · Chrome Dino cabinet · Space Ripper cabinet  |
| **Atompoint Fields · 2025** | NE    | wheat-cream field            | Missed Punches (erratic, 2 HP)| Journey ch.2 + attendance-system card                      |
| **n8n Nexus**             | center  | teal circuit floor           | Tangled Crons (tanky, 3 HP)   | Skills + the n8n note                                      |
| **BeamHive Reach · 2026** | SE      | honey-orange comb floor      | Cold Lead Slimes (2 HP) + **Raw List Golem** boss (20 HP) | Journey ch.3 + Lead Gen Engine card (live link) |

Crossing a zone boundary slides a region banner in and plays a chime.

---

## 4. Player & combat

- **Move:** WASD / arrows, 8-way, ~90 u/s. Sprite: cream-armored knight,
  orange plume; 2-frame walk per facing (side flips X).
- **Sword:** always visible in hand (child object). **Space/J** swings it
  120° in ~120 ms (tween) with a crescent slash effect, 0.3 s cooldown,
  and a short-lived arc hitbox in the facing direction.
- **Hit feedback:** knockback, white flash on the mob, 4-px screen shake,
  synth "thunk"; kill = poof particles + floating score text.
- **Health:** 3 hearts, contact damage = 1, 1 s of i-frame blinking.
  Slimes occasionally drop hearts (cap 3) or score gems.
- **Death:** "YOU GOT AUTOMATED" game-over card with score, high score
  (localStorage), Restart and Exit.

## 5. Mobs & scoring

- AI: wander (drift, random re-aim every 1–2 s) → chase when player is
  within ~120 u. Per-region spawners keep a small population alive
  (respawn ~8 s, global cap ~24, never inside the safe zone).
- Boss: scaled-up slime, slow, 20 HP, +500 pts, one-time "REGION CLEARED"
  fanfare.
- Score: bug 50 · slime 100 · punch 150 · cron 200 · gem 75 · boss 500.
  **Combo:** kills within 3 s chain a ×1 → ×4 multiplier shown in the HUD.

## 6. Sound (all synthesized)

`synth.js` — one AudioContext created on Press Start (satisfies autoplay
rules): slash (band-passed noise sweep), hit (square blip), kill (up-chirp),
hurt (down saw + noise), heart (soft 5th), panel open (page tick), region
chime (two-note bell), game-over (descending triad), plus an 8-step lo-fi
chiptune loop (square lead + triangle bass) at low gain. **M** or the HUD
button mutes; audio hard-stops when the tab hides or the game closes.

## 7. HUD / UX

- In-canvas (fixed layer): hearts, score + combo, region banner.
- DOM layer (site typography): monument cards (cream `card-soft` styling,
  Fraunces headings, real links), controls hint, mute + exit buttons,
  game-over screen, and touch controls (virtual D-pad + attack) on
  coarse pointers.
- **E** interacts with monuments; the world pauses while a card is open.
  **Esc** closes card → exits game.

## 8. Performance & a11y

- KAPLAY chunk (~200 kB) + game code load only on Press Start.
- 640×360 internal res keeps fill-rate trivial; `offscreen({hide})` culls
  far mobs; particles are short-lived rects.
- Game loop dies with the overlay (`k.quit()`); Lenis and the scroll site
  resume untouched.
- The classic site remains the fully readable, reduced-motion-safe path —
  the game is opt-in by a real user gesture, keyboard-first, with visible
  focus states on DOM controls.

## 9. Risks / cuts

- KAPLAY API drift (3001 vs docs): pin `^3001.0.19`, smoke-test headless.
- Pixel-art quality: charming-rough is acceptable; palette carries it.
- If time pressure: cut boss minion phase (done — boss is just big),
  cut gem pickups before cutting combo (combo sells the arcade feel).
