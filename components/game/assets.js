/*
  assets.js — CC0 art pipeline.

  Art credits (both CC0/public domain, see public/game/CREDITS.txt):
    - 0x72 DungeonTileset II v1.7 (characters, weapons, props, UI)
    - Kenney Roguelike/RPG pack (overworld terrain)

  The entire static world (2,816 floor cells + walls + water + decor) is
  baked into ONE canvas texture at boot and added as a single sprite —
  this is the fix for the tile-object flood that dropped KAPLAY to 1-2
  fps. Solids become ~40 merged invisible collider rects instead of ~600
  per-tile bodies.
*/

import { ATLAS } from "./atlas0x72";
import { WORLD, regionAt } from "./content";

const T = 16; // world tile size
const K = 17; // kenney sheet stride (16px tile + 1px gutter)

/* ---- kenney terrain picks (col, row on the sheet) ---- */
const TER = {
  grass: [[10, 26], [10, 29]],
  sand: [[7, 26], [7, 29]],
  rust: [[13, 26], [13, 29]],
  teal: [[16, 26], [16, 29]],
  grey: [[4, 26], [4, 29]],
  dirt: [[1, 26], [1, 29]],
  water: [[0, 0], [1, 0], [0, 2]],
  waterSparkle: [0, 1],
  flowerRed: [0, 6],
  flowerWhite: [0, 9],
  flowerBlue: [0, 12],
  treeGreen: [13, 9],
  treeOrange: [14, 9],
  pineGreen: [16, 9],
  pineOrange: [17, 9],
  hedgeGreen: [19, 9],
  hedgeOrange: [20, 9],
  rock: [54, 20],
  rock2: [55, 20],
  mound: [54, 18],
  fence: [47, 22],
  statue: [51, 11],
  tomb: [52, 11],
  campfire: [14, 8],
};

// region id → ground family + decor flavor
const REGION_STYLE = {
  landing: { ground: "grass", flower: "flowerWhite", tree: "treeGreen", wallProp: "hedgeGreen", tint: null },
  origins: { ground: "grey", flower: "flowerBlue", tree: "pineGreen", wallProp: "rock", tint: "rgba(0,21,36,0.38)" },
  atompoint: { ground: "sand", flower: "flowerRed", tree: "treeOrange", wallProp: "fence", tint: "rgba(120,41,15,0.08)" },
  nexus: { ground: "teal", flower: "flowerBlue", tree: "pineGreen", wallProp: "rock2", tint: "rgba(21,97,109,0.15)" },
  beamhive: { ground: "rust", flower: "flowerRed", tree: "pineOrange", wallProp: "mound", tint: "rgba(255,125,0,0.07)" },
};

function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* greedy rect merge: rows of solid runs, then stack identical runs */
function mergeColliders(solid, W, H) {
  const runs = []; // {x, y, w, h}
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!solid[y][x]) {
        x++;
        continue;
      }
      let x2 = x;
      while (x2 < W && solid[y][x2]) x2++;
      runs.push({ x, y, w: x2 - x, h: 1 });
      x = x2;
    }
  }
  // merge vertically-adjacent identical spans
  const out = [];
  for (const r of runs) {
    const prev = out.find((o) => o.x === r.x && o.w === r.w && o.y + o.h === r.y);
    if (prev) prev.h += 1;
    else out.push({ ...r });
  }
  return out;
}

/*
  Bakes the world. Returns:
    { url, colliders: [{x,y,w,h} px], monumentSpots: [{ch,x,y} px] }
*/
export async function bakeWorld(world) {
  const terrain = await loadImage("/game/terrain.png");
  const { W, H } = WORLD;
  const cv = document.createElement("canvas");
  cv.width = W * T;
  cv.height = H * T;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;

  const rnd = seededRand(20260718);
  const stamp = (pick, dx, dy) => {
    const [c, r] = pick;
    g.drawImage(terrain, c * K, r * K, T, T, dx * T, dy * T, T, T);
  };
  const pickVariant = (arr) => arr[Math.floor(rnd() * arr.length)];

  const objAt = (x, y) => world.objRows[y][x];
  const isWater = (x, y) => x < 0 || y < 0 || x >= W || y >= H || objAt(x, y) === "~";

  /* pass 1 — ground everywhere (also under walls/props), region-dithered */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (objAt(x, y) === "~") {
        stamp(rnd() < 0.06 ? TER.waterSparkle : pickVariant(TER.water), x, y);
        continue;
      }
      let region = regionAt(x, y);
      // dither the region seams so grounds interlock organically
      const neighbors = [regionAt(x + 1, y), regionAt(x - 1, y), regionAt(x, y + 1), regionAt(x, y - 1)];
      const other = neighbors.find((n) => n && n.id !== region.id);
      if (other && rnd() < 0.38) region = other;
      stamp(pickVariant(TER[REGION_STYLE[region.id].ground]), x, y);
    }
  }

  /* pass 2 — per-region tint washes (before props so props stay crisp) */
  for (const [id, style] of Object.entries(REGION_STYLE)) {
    if (!style.tint) continue;
    g.fillStyle = style.tint;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (objAt(x, y) !== "~" && regionAt(x, y).id === id) {
          g.fillRect(x * T, y * T, T, T);
        }
      }
    }
  }

  /* pass 3 — shorelines: darken land edges that touch water */
  g.fillStyle = "rgba(0,21,36,0.30)";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (objAt(x, y) === "~") continue;
      if (isWater(x - 1, y)) g.fillRect(x * T, y * T, 3, T);
      if (isWater(x + 1, y)) g.fillRect(x * T + T - 3, y * T, 3, T);
      if (isWater(x, y - 1)) g.fillRect(x * T, y * T, T, 3);
      if (isWater(x, y + 1)) g.fillRect(x * T, y * T + T - 3, T, 3);
    }
  }

  /* pass 4 — props: region walls, decor, ambient trees */
  const monumentSpots = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = objAt(x, y);
      const style = REGION_STYLE[regionAt(x, y).id];
      if (ch === "#") {
        // soft shadow then the divider prop
        g.fillStyle = "rgba(0,21,36,0.22)";
        g.fillRect(x * T + 1, y * T + 10, 14, 5);
        stamp(TER[style.wallProp], x, y);
      } else if (ch === "f") {
        stamp(TER[style.flower], x, y);
      } else if (ch === "p") {
        stamp(rnd() < 0.5 ? TER.rock : TER.mound, x, y);
      } else if (ch === " ") {
        // sparse ambient trees away from anything busy
        if (rnd() < 0.015) {
          g.fillStyle = "rgba(0,21,36,0.20)";
          g.fillRect(x * T + 2, y * T + 11, 12, 4);
          stamp(rnd() < 0.7 ? TER[style.tree] : TER.treeGreen, x, y);
        }
      } else if (/[A-Z]/.test(ch)) {
        monumentSpots.push({ ch, x: x * T, y: y * T });
      }
    }
  }

  /* pass 5 — a campfire to warm the landing */
  stamp(TER.campfire, 8, 16);

  /* colliders: '#', '~', and monuments all block movement */
  const solid = [];
  for (let y = 0; y < H; y++) {
    solid.push(new Array(W).fill(false));
    for (let x = 0; x < W; x++) {
      const ch = objAt(x, y);
      solid[y][x] = ch === "#" || ch === "~" || /[A-Z]/.test(ch);
    }
  }
  const colliders = mergeColliders(solid, W, H).map((r) => ({
    x: r.x * T,
    y: r.y * T,
    w: r.w * T,
    h: r.h * T,
  }));

  return { url: cv.toDataURL(), colliders, monumentSpots };
}

/* ---- 0x72 atlas → kaplay loadSpriteAtlas entries ---- */

// name → [atlasKey, animSpeed] ; frames are horizontally contiguous
const SHEET_SPRITES = {
  "hero-idle": ["knight_m_idle_anim", 8],
  "hero-run": ["knight_m_run_anim", 12],
  "hero-hit": ["knight_m_hit_anim", 8],
  sword: ["weapon_regular_sword", 0],
  goblin: ["goblin_run_anim", 8],
  "goblin-idle": ["goblin_idle_anim", 5],
  slug: ["slug_anim", 6],
  zombie: ["tiny_zombie_run_anim", 8],
  "zombie-idle": ["tiny_zombie_idle_anim", 5],
  chort: ["chort_run_anim", 8],
  "chort-idle": ["chort_idle_anim", 5],
  demon: ["big_demon_run_anim", 8],
  "demon-idle": ["big_demon_idle_anim", 5],
  crate: ["crate", 0],
  chest: ["chest_full_open_anim", 0],
  fountain: ["wall_fountain_mid_blue_anim", 5],
  skull: ["skull", 0],
  "heart-full": ["ui_heart_full", 0],
  "heart-empty": ["ui_heart_empty", 0],
  flask: ["flask_big_red", 0],
  coin: ["coin_anim", 8],
};

export function loadDungeonSprites(k) {
  const entries = {};
  for (const [name, [key, speed]] of Object.entries(SHEET_SPRITES)) {
    const frames = ATLAS[key];
    if (!frames) continue;
    const f0 = frames[0];
    entries[name] = {
      x: f0.x,
      y: f0.y,
      width: f0.w * frames.length,
      height: f0.h,
      sliceX: frames.length,
      ...(frames.length > 1
        ? { anims: { play: { from: 0, to: frames.length - 1, loop: true, speed } } }
        : {}),
    };
  }
  k.loadSpriteAtlas("/game/dungeon.png", entries);
}
