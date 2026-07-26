/*
  characters.js — the new side-view character pipeline (Tiny RPG Character
  Asset Packs 01/02 by freeraw). Replaces the old 0x72 single-loop sprites.

  Each character ships as SEPARATE 100x100 sheets, one PNG per animation
  (idle / walk / attack1 / attack2 [/ attack3] / hurt / death). At boot we
  composite each character's sheets into ONE grid atlas canvas (row per anim)
  and register it as a single kaplay sprite with named anims — so an entity is
  `k.sprite("soldier")` and switches state with `setAnim(e, "walk")`, no
  per-frame texture swapping.

  Bodies are ~17-22px inside the 100px frame, sitting at a per-character offset
  (measured with sharp — see CHAR_META.anchor). We anchor each character at its
  own body-centre/feet so (a) pos sits at the feet for depth sort + shadows and
  (b) flipX mirrors around the body centre, so turning left/right never makes
  the sprite hop sideways.
*/

// frame counts per animation (measured: width / 100). attack3 is soldier-only.
export const CHAR_FRAMES = {
  soldier: { idle: 6, walk: 8, attack1: 6, attack2: 6, attack3: 9, hurt: 4, death: 4 },
  orc: { idle: 6, walk: 8, attack1: 6, attack2: 6, hurt: 4, death: 4 },
  demon: { idle: 6, walk: 8, attack1: 7, attack2: 7, hurt: 4, death: 4 },
  blood: { idle: 6, walk: 8, attack1: 8, attack2: 8, hurt: 4, death: 4 },
};

// per-character render metadata. anchor is a kaplay Vec2 in -1..1 space, placed
// at the measured (bodyCentreX, feetY) within the 100px frame:
//   ax = centreX/50 - 1 ,  ay = feetY/50 - 1
export const CHAR_META = {
  soldier: { anchor: [-0.02, 0.18], scale: 1.0 },
  orc: { anchor: [0.09, 0.14], scale: 1.0 },
  demon: { anchor: [0.06, 0.18], scale: 1.0 },
  blood: { anchor: [0.03, 0.14], scale: 1.0 },
};

// anim playback: fps per anim, and which anims loop (everything else is a
// one-shot that returns to idle/walk via onEnd)
const SPEED = { idle: 7, walk: 12, attack1: 15, attack2: 15, attack3: 15, hurt: 14, death: 9 };
const LOOP = new Set(["idle", "walk"]);

const FRAME = 100; // px per frame in the source sheets

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/*
  Character loading is split in two so kaplay sees ONE load phase:

    prepareCharacters()          — async; loads the source PNGs and composites
                                   each character's grid-atlas canvas. Call this
                                   BEFORE kaplay boots (alongside the map bakes).
    registerCharacters(k, prep)  — sync; registers the atlases on `k`. Call this
                                   inside buildGame with the other loadSprite
                                   calls, with NO await in between — otherwise
                                   kaplay's initial load can complete on just the
                                   characters and fire onLoad before the map /
                                   dungeon sprites finish (→ null sprite data).
*/
export async function prepareCharacters() {
  const prepared = [];
  for (const [name, frames] of Object.entries(CHAR_FRAMES)) {
    const animNames = Object.keys(frames); // insertion order = row order
    const cols = Math.max(...Object.values(frames)); // widest anim → grid width
    const rows = animNames.length;

    const imgs = await Promise.all(
      animNames.map((a) => loadImage(`/game/chars/${name}/${a}.png`))
    );
    const cv = document.createElement("canvas");
    cv.width = cols * FRAME;
    cv.height = rows * FRAME;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    animNames.forEach((a, r) => g.drawImage(imgs[r], 0, r * FRAME));

    // named anims → global frame index ranges over the cols×rows grid
    const anims = {};
    animNames.forEach((a, r) => {
      const base = r * cols;
      anims[a] = { from: base, to: base + frames[a] - 1, loop: LOOP.has(a), speed: SPEED[a] };
    });

    prepared.push({ name, url: cv.toDataURL(), width: cv.width, height: cv.height, cols, rows, anims });
  }
  return prepared;
}

export function registerCharacters(k, prepared) {
  // one composited image per character → a single sprite sliced cols×rows with
  // named anims (the documented loadSprite-with-anims form)
  for (const p of prepared) {
    k.loadSprite(p.name, p.url, { sliceX: p.cols, sliceY: p.rows, anims: p.anims });
  }
}

/* kaplay Vec2 anchor for a character (feet / body-centre) */
export function charAnchor(k, name) {
  const [ax, ay] = CHAR_META[name].anchor;
  return k.vec2(ax, ay);
}

/*
  Animation state machine. setAnim(e, "walk") is the only way state changes:
    - looping states (idle/walk) no-op if already current (so the loop keeps
      its phase and doesn't stutter),
    - one-shots (attack / hurt / death) always (re)start and fire opts.onEnd when
      the clip finishes. Pass { force:true } to restart a looping anim.
  Entities track their current anim on `_anim`; read it with curAnim(e).
*/
export function setAnim(e, name, opts = {}) {
  if (e._anim === name && LOOP.has(name) && !opts.force) return;
  e._anim = name;
  e.play(name, { loop: LOOP.has(name), speed: SPEED[name], onEnd: opts.onEnd });
}

export function curAnim(e) {
  return e._anim;
}

// duration (seconds) of a one-shot clip — used to time attack hit-frames and
// recovery locks without re-measuring at call sites
export function animDuration(name, frames) {
  return frames / SPEED[name];
}
