/*
  content.js — the overworld. A 64×44 tile grid built programmatically
  (rect fills, walls with gates, seeded decor) plus the monument cards,
  which pull their copy straight from lib/data.js so the game and the
  scroll site share one source of truth.
*/

import { identity, chapters, work, projects, skills } from "@/lib/data";

/*
  The world is a west→east strip: Landing → Pixel Origins → Atompoint →
  Nexus → BeamHive. One walled gate between each pair of regions, so the
  path forward is always "go right".
*/
export const WORLD = { W: 112, H: 26, TILE: 16 };

// region x-spans (walls at x = 23/45/67/89 with 5-tile central gates)
const BOUNDS = [
  { id: "landing", x1: 23 },
  { id: "origins", x1: 45 },
  { id: "atompoint", x1: 67 },
  { id: "nexus", x1: 89 },
  { id: "beamhive", x1: 111 },
];

/* ---------------- monument content ---------------- */

const dino = projects.find((p) => p.id === "chrome-dino");
const ripper = projects.find((p) => p.id === "space-ripper");
const bm = projects.find((p) => p.id === "bm-accounting");
const atompoint = work.find((w) => w.id === "atompoint");
const beamhive = work.find((w) => w.id === "beamhive");
const n8nWork = work.find((w) => w.id === "n8n");
const autoSkill = skills.find((s) => s.featured);

export const MONUMENTS = {
  A: {
    kicker: "The Landing",
    title: "Welcome, traveler",
    body: "This is my portfolio with a sword in it. Each region is a real chapter: the game engines I started with, the internship, the lead-gen engine I run now. Read the monuments, thump the mobs, chase the score.",
    tags: ["WASD / arrows — move", "Space — swing", "E — read", "M — mute", "Esc — leave"],
  },
  B: {
    kicker: `${bm.year} · ${bm.role}`,
    title: bm.title,
    body: `${bm.kicker}. ${bm.body}`,
    tags: bm.stack,
    links: [{ label: "View on GitHub", href: bm.github }],
  },
  C: {
    kicker: "Contact obelisk",
    title: "Say hello",
    body: "Open to internships and automation contracts. The obelisk hums quietly. It accepts email.",
    links: [
      { label: identity.email, href: `mailto:${identity.email}` },
      { label: "LinkedIn", href: identity.linkedin },
      { label: "GitHub", href: identity.github },
    ],
  },
  D: {
    kicker: `${chapters[0].year} · Chapter one`,
    title: chapters[0].title,
    body: chapters[0].body,
  },
  E: {
    kicker: `${dino.year} · ${dino.role}`,
    title: dino.title,
    body: `${dino.kicker}. ${dino.body}`,
    tags: dino.stack,
    links: [{ label: "View on GitHub", href: dino.github }],
  },
  F: {
    kicker: `${ripper.year} · ${ripper.role}`,
    title: ripper.title,
    body: `${ripper.kicker}. ${ripper.body}`,
    tags: ripper.stack,
    links: [{ label: "View on GitHub", href: ripper.github }],
  },
  G: {
    kicker: `${chapters[1].year} · ${atompoint.org}`,
    title: atompoint.title,
    body: `${chapters[1].body} ${atompoint.outcome}`,
    tags: atompoint.tags,
  },
  H: {
    kicker: `${chapters[2].year} · ${beamhive.org} · ${beamhive.status}`,
    title: beamhive.title,
    body: `${beamhive.body} ${beamhive.outcome}`,
    tags: beamhive.tags,
    links: [{ label: beamhive.link.label, href: beamhive.link.href }],
  },
  I: {
    kicker: "The automation core",
    title: "n8n Nexus",
    body: `${autoSkill.note} Standing orchestrations too: ${n8nWork.body}`,
    tags: skills.flatMap((s) => s.items).slice(0, 12),
  },
  // the arcade portal — a disclaimer card whose action drops you into the
  // endless wave mode (Unlimited Arcade). Absent from PROGRESSION, so it
  // gates nothing and is purely optional.
  J: {
    kicker: "Optional · endless mode",
    title: "Unlimited Arcade",
    body: "Step through and the rules change: endless waves of enemies, each harder than the last, until you fall. No monuments, no story — just how long you last and how high you score. Every run is ranked on the global leaderboard.",
    tags: ["WASD / arrows — move", "LMB — sword", "Space — fireball", "Esc — back to story"],
    action: { label: "Enter the arcade" },
  },
};

// short floating labels shown above each monument in-world
export const MONUMENT_LABELS = {
  A: "README",
  B: "BM APP",
  C: "CONTACT",
  D: "2024",
  E: "DINO",
  F: "RIPPER",
  G: "2025",
  H: "BEAMHIVE",
  I: "SKILLS",
  J: "ARCADE",
};

/*
  Progression: regions unlock in story order. Each step needs its kills
  and its monument read; completing a step blows open the fences on the
  listed gate cells.
*/
export const PROGRESSION = [
  {
    region: "landing",
    kills: 0,
    monument: "A",
    objective: "READ THE WELCOME SIGN",
    gateName: "PIXEL ORIGINS",
    gateCells: [[23, 11], [23, 12], [23, 13], [23, 14], [23, 15]],
  },
  {
    region: "origins",
    kills: 5,
    monument: "D",
    objective: "SLAY 5 BUGS + READ THE 2024 STONE",
    gateName: "ATOMPOINT FIELDS",
    gateCells: [[45, 11], [45, 12], [45, 13], [45, 14], [45, 15]],
  },
  {
    region: "atompoint",
    kills: 5,
    monument: "G",
    objective: "CRUSH 5 PUNCHES + READ THE 2025 STONE",
    gateName: "N8N NEXUS",
    gateCells: [[67, 11], [67, 12], [67, 13], [67, 14], [67, 15]],
  },
  {
    region: "nexus",
    kills: 4,
    monument: "I",
    objective: "UNTANGLE 4 CRONS + READ THE SKILLS OBELISK",
    gateName: "BEAMHIVE REACH",
    gateCells: [[89, 11], [89, 12], [89, 13], [89, 14], [89, 15]],
  },
  {
    region: "beamhive",
    kills: 0,
    monument: "H",
    boss: true,
    objective: "READ THE BEAMHIVE STONE + FELL THE GOLEM",
  },
];

// which sprite each monument char uses
export const MONUMENT_SPRITES = {
  A: "monument",
  B: "cabinet",
  C: "obelisk",
  D: "monument",
  E: "cabinet",
  F: "cabinet",
  G: "monument",
  H: "monument",
  I: "obelisk",
  J: "obelisk",
};

/* ---------------- regions ---------------- */

export const REGIONS = [
  { id: "landing", name: "THE LANDING", sub: "safe ground" },
  { id: "origins", name: "PIXEL ORIGINS", sub: "2024 · it started with pixels" },
  { id: "atompoint", name: "ATOMPOINT FIELDS", sub: "2025 · then it got real" },
  { id: "nexus", name: "n8n NEXUS", sub: "the automation core" },
  { id: "beamhive", name: "BEAMHIVE REACH", sub: "2026 · now it's the job" },
];

export function regionAt(tx) {
  const b = BOUNDS.find((r) => tx <= r.x1) || BOUNDS[BOUNDS.length - 1];
  return REGIONS.find((r) => r.id === b.id);
}

/* ---------------- grid builder ---------------- */

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

export function buildWorld() {
  const { W, H } = WORLD;
  const floor = [];
  const obj = [];
  for (let y = 0; y < H; y++) {
    floor.push(new Array(W).fill(" "));
    obj.push(new Array(W).fill(" "));
  }

  const floorId = { landing: "1", origins: "2", atompoint: "3", nexus: "5", beamhive: "4" };
  const floorFor = (x) => floorId[regionAt(x).id];

  // land strip + water ring
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < 2 || x > W - 3 || y < 2 || y > H - 3) obj[y][x] = "~";
      else floor[y][x] = floorFor(x);
    }
  }

  const wall = (x, y) => {
    if (obj[y] && obj[y][x] === " ") obj[y][x] = "#";
  };
  const vWall = (x, y0, y1, gates = []) => {
    for (let y = y0; y <= y1; y++) {
      if (!gates.some(([g0, g1]) => y >= g0 && y <= g1)) wall(x, y);
    }
  };

  // one wall per region border, central 5-tile gate — the way forward
  // is always east
  const GATE = [[11, 15]];
  vWall(23, 2, 23, GATE);
  vWall(45, 2, 23, GATE);
  vWall(67, 2, 23, GATE);
  vWall(89, 2, 23, GATE);

  // monuments, laid out along the west→east path
  const monuments = [
    ["A", 10, 12],
    ["B", 14, 8],
    ["C", 14, 18],
    ["J", 19, 17], // arcade portal — optional, in The Landing
    ["D", 30, 7],
    ["E", 34, 13],
    ["F", 38, 18],
    ["G", 56, 8],
    ["I", 78, 13],
    ["H", 96, 8],
  ];
  monuments.forEach(([ch, x, y]) => (obj[y][x] = ch));

  // mob spawners + boss + player (spawners are one-shot: no respawns)
  const spawns = [];
  const S = (type, x, y) => spawns.push({ type, x, y });
  // populations run ~1.5-2x the objective so the last kill is never a
  // scavenger hunt (and there's spare score to chase)
  S("bug", 27, 6);
  S("bug", 33, 5);
  S("bug", 39, 8);
  S("bug", 28, 14);
  S("bug", 36, 12);
  S("bug", 31, 19);
  S("bug", 41, 17);
  S("bug", 43, 12);
  S("punch", 49, 7);
  S("punch", 55, 5);
  S("punch", 61, 8);
  S("punch", 50, 14);
  S("punch", 58, 12);
  S("punch", 53, 19);
  S("punch", 63, 17);
  S("punch", 65, 12);
  S("cron", 71, 7);
  S("cron", 77, 6);
  S("cron", 83, 9);
  S("cron", 73, 17);
  S("cron", 80, 13);
  S("cron", 86, 18);
  S("slime", 93, 8);
  S("slime", 98, 6);
  S("slime", 94, 17);
  S("slime", 100, 19);
  S("slime", 106, 9);
  S("slime", 107, 18);
  S("boss", 102, 13);

  const playerSpawn = { x: 6, y: 13 };

  // seeded decor sprinkle, kept off walls/monuments/gates
  const rnd = seededRand(20260714);
  for (let y = 3; y < H - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      if (obj[y][x] !== " ") continue;
      const nearBusy =
        monuments.some(([, mx, my]) => Math.abs(mx - x) + Math.abs(my - y) < 3) ||
        (Math.abs(playerSpawn.x - x) + Math.abs(playerSpawn.y - y)) < 3;
      if (nearBusy) continue;
      const roll = rnd();
      if (roll < 0.02) obj[y][x] = "f";
      else if (roll < 0.035) obj[y][x] = "p";
    }
  }

  return {
    floorRows: floor.map((r) => r.join("")),
    objRows: obj.map((r) => r.join("")),
    spawns,
    playerSpawn,
  };
}
