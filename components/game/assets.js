/*
  assets.js — art pipeline.

  Art credits (see public/game/CREDITS.txt):
    - LimeZu "Modern Interiors" (free) — the renovated map floors + walls
      (public/game/tiles/room_builder.png, 16px tiles, NO gutter)
    - 0x72 DungeonTileset II — HUD hearts, flask/coin pickups, chest/fountain
      monuments (public/game/dungeon.png)
    - Kenney Roguelike/RPG pack — the statue/fence monument + gate sprites
      (public/game/terrain.png)
    - Characters: Tiny RPG Character packs, loaded by characters.js

  The entire static world is baked into ONE canvas texture at boot and added as
  a single sprite — the fix for the tile-object flood that dropped KAPLAY to
  1-2 fps. Solids become ~40 merged invisible collider rects.
*/

import { ATLAS } from "./atlas0x72";
import { WORLD, regionAt } from "./content";

const T = 16; // world tile size
const K = 17; // kenney sheet stride (16px tile + 1px gutter) — legacy sprites
const M = 16; // modern-interiors sheet stride (16px tile, NO gutter)

/* ---- Modern Interiors picks (col,row on room_builder.png, 16px no gutter) ----
   Each region gets a distinct floor swatch; walls/void are shared. */
const RB = {
  floorCream: [11, 7], // warm cross-tile
  floorGrey: [11, 11], // neutral concrete
  floorBrick: [11, 5], // terracotta brick
  floorTeal: [11, 9], // cool circle-tile
  floorHerring: [11, 13], // orange herringbone wood
  floorStone: [14, 6], // grey stone (arena)
  wall: [12, 0], // dark solid room-border block
};

// region id → floor swatch + a colour wash for identity (kept from the old
// "Deep Water" palette so each room still reads distinct)
const REGION_STYLE = {
  landing: { floor: "floorCream", tint: null },
  origins: { floor: "floorGrey", tint: "rgba(0,21,36,0.30)" },
  atompoint: { floor: "floorBrick", tint: "rgba(120,41,15,0.10)" },
  nexus: { floor: "floorTeal", tint: "rgba(21,97,109,0.14)" },
  beamhive: { floor: "floorHerring", tint: "rgba(255,125,0,0.08)" },
};

const VOID = "#04121a"; // outside-the-building border (was water)
const WALL_BASE = "#0a2230"; // dark backing under wall tiles

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
  const runs = [];
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
  const out = [];
  for (const r of runs) {
    const prev = out.find((o) => o.x === r.x && o.w === r.w && o.y + o.h === r.y);
    if (prev) prev.h += 1;
    else out.push({ ...r });
  }
  return out;
}

/*
  Bakes the world (Modern Interiors reskin). Returns:
    { url, colliders: [{x,y,w,h} px], monumentSpots: [{ch,x,y} px] }
*/
export async function bakeWorld(world) {
  const rb = await loadImage("/game/tiles/room_builder.png");
  const { W, H } = WORLD;
  const cv = document.createElement("canvas");
  cv.width = W * T;
  cv.height = H * T;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;

  const rnd = seededRand(20260718);
  const stamp = (pick, dx, dy) => {
    const [c, r] = pick;
    g.drawImage(rb, c * M, r * M, T, T, dx * T, dy * T, T, T);
  };
  const stampFloor = (styleKey, dx, dy) => stamp(RB[REGION_STYLE[styleKey].floor], dx, dy);

  const objAt = (x, y) => world.objRows[y][x];
  const isVoid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || objAt(x, y) === "~";

  /* pass 1 — floors everywhere (also under walls/props), region-dithered at the
     seams so adjacent rooms interlock a little */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (objAt(x, y) === "~") {
        g.fillStyle = VOID;
        g.fillRect(x * T, y * T, T, T);
        continue;
      }
      let region = regionAt(x, y);
      const neighbors = [regionAt(x + 1, y), regionAt(x - 1, y), regionAt(x, y + 1), regionAt(x, y - 1)];
      const other = neighbors.find((n) => n && n.id !== region.id);
      if (other && rnd() < 0.32) region = other;
      stampFloor(region.id, x, y);
    }
  }

  /* pass 2 — per-region colour washes (before props so props stay crisp) */
  for (const [id, style] of Object.entries(REGION_STYLE)) {
    if (!style.tint) continue;
    g.fillStyle = style.tint;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (objAt(x, y) !== "~" && regionAt(x, y).id === id) g.fillRect(x * T, y * T, T, T);
      }
    }
  }

  /* pass 3 — edge shadows where floor meets the void (depth at the walls) */
  g.fillStyle = "rgba(0,10,18,0.42)";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (objAt(x, y) === "~") continue;
      if (isVoid(x - 1, y)) g.fillRect(x * T, y * T, 3, T);
      if (isVoid(x + 1, y)) g.fillRect(x * T + T - 3, y * T, 3, T);
      if (isVoid(x, y - 1)) g.fillRect(x * T, y * T, T, 3);
      if (isVoid(x, y + 1)) g.fillRect(x * T, y * T + T - 3, T, 3);
    }
  }

  /* pass 4 — walls + monuments (decor dropped for a clean interior) */
  const monumentSpots = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = objAt(x, y);
      if (ch === "#") {
        g.fillStyle = WALL_BASE;
        g.fillRect(x * T, y * T, T, T);
        stamp(RB.wall, x, y);
        // soft base shadow so walls sit on the floor
        g.fillStyle = "rgba(0,10,18,0.30)";
        g.fillRect(x * T, y * T + T - 3, T, 3);
      } else if (/[A-Z]/.test(ch)) {
        monumentSpots.push({ ch, x: x * T, y: y * T });
      }
    }
  }

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

/*
  Bakes the endless-arena floor: a 40×22 walled room (static camera, so no
  scroll maths). Modern grey-stone floor, a 2-tile wall ring, four 2×2 pillars.
  Returns { url, colliders, W, H, playerSpawn, alcoves }.
*/
export async function bakeArena() {
  const rb = await loadImage("/game/tiles/room_builder.png");
  const AW = 40;
  const AH = 22;
  const cv = document.createElement("canvas");
  cv.width = AW * T;
  cv.height = AH * T;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;

  const stamp = (pick, dx, dy) => {
    const [c, r] = pick;
    g.drawImage(rb, c * M, r * M, T, T, dx * T, dy * T, T, T);
  };

  // solids: a 2-tile wall ring + four 2×2 pillars
  const solid = [];
  for (let y = 0; y < AH; y++) solid.push(new Array(AW).fill(false));
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      if (x < 2 || x >= AW - 2 || y < 2 || y >= AH - 2) solid[y][x] = true;
    }
  }
  const pillars = [[11, 7], [27, 7], [11, 14], [27, 14]];
  for (const [px, py] of pillars) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) solid[py + dy][px + dx] = true;
    }
  }

  // grey-stone floor everywhere, then an ink wash so it reads apart from the
  // story rooms
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) stamp(RB.floorStone, x, y);
  }
  g.fillStyle = "rgba(0,21,36,0.30)";
  g.fillRect(0, 0, cv.width, cv.height);

  // walls + pillars: dark backing + wall tile + base shadow
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      if (!solid[y][x]) continue;
      g.fillStyle = WALL_BASE;
      g.fillRect(x * T, y * T, T, T);
      stamp(RB.wall, x, y);
      g.fillStyle = "rgba(0,10,18,0.30)";
      g.fillRect(x * T, y * T + T - 3, T, 3);
    }
  }

  // darken the interior edge that faces the wall, for a lit-pit feel
  g.fillStyle = "rgba(0,10,18,0.34)";
  for (let y = 2; y < AH - 2; y++) {
    for (let x = 2; x < AW - 2; x++) {
      if (x === 2) g.fillRect(x * T, y * T, 3, T);
      if (x === AW - 3) g.fillRect(x * T + T - 3, y * T, 3, T);
      if (y === 2) g.fillRect(x * T, y * T, T, 3);
      if (y === AH - 3) g.fillRect(x * T, y * T + T - 3, T, 3);
    }
  }

  const colliders = mergeColliders(solid, AW, AH).map((r) => ({
    x: r.x * T,
    y: r.y * T,
    w: r.w * T,
    h: r.h * T,
  }));

  const alcoves = [
    [6, 5], [33, 5], [6, 16], [33, 16],
    [20, 3], [20, 18], [3, 11], [36, 11],
  ];

  return {
    url: cv.toDataURL(),
    colliders,
    W: AW,
    H: AH,
    playerSpawn: { x: 20 * T + 8, y: 11 * T + 14 },
    alcoves,
  };
}

/* ---- 0x72 atlas → kaplay loadSpriteAtlas entries ---- */

// name → [atlasKey, animSpeed] ; frames are horizontally contiguous.
// Trimmed to only what the redesign still draws from dungeon.png: HUD hearts,
// the flask/coin pickups, and the chest/fountain monuments. The old
// hero/sword/mob sprites are gone — characters now come from characters.js.
// (NB: "demon" here used to collide with the new demon character sprite.)
const SHEET_SPRITES = {
  chest: ["chest_full_open_anim", 0],
  fountain: ["wall_fountain_mid_blue_anim", 5],
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
