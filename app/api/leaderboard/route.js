/*
  /api/leaderboard - the global board behind Unlimited Arcade.

  Storage is one Redis sorted set (Upstash): member = the run payload,
  score = the run's score, so the top-N read is a single round trip that
  comes back already sorted. See scratchpad/upstash-smoke.mjs for the bare
  data model this mirrors.

  Credentials: accepts BOTH the native Upstash names and Vercel's KV_* names
  (a Vercel-provisioned Upstash DB injects KV_REST_API_URL / KV_REST_API_TOKEN),
  so it works regardless of how the database was created. If neither pair is
  present (fresh clone, local dev with no secrets) every read degrades to an
  empty board with configured:false instead of throwing - the site must build
  and render with no database.
*/

import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// top scores must never be served stale from the static cache
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOARD_KEY = "arcade:board";
const TOP_N = 10; // rows returned to clients
const KEEP_N = 50; // rows retained in Redis (trimmed after each write)

const RL_MAX = 5; // submissions allowed...
const RL_WINDOW = 600; // ...per this many seconds, per IP

const NAME_MAX = 12;
const SCORE_MAX = 5_000_000;
const WAVE_MAX = 500;
// Score can't exceed this for the claimed wave — a wave-2 run posting 500k is
// a forgery. Max real score grows ~quadratically with wave (per-wave mob count,
// the score multiplier, and up to a 4x combo all compound), so a LINEAR ceiling
// wrongly rejects deep legit runs. This quadratic bound sits safely above the
// theoretical max at every wave (verified against the arena's wave design)
// while still catching absurd forgeries.
const plausibleCeiling = (wave) => 1300 * wave * wave + 2000 * wave + 6000;

// small, conservative list - a full filter is overkill for 12 chars, but the
// board sits on a portfolio a recruiter may read, so block the obvious.
const PROFANITY = ["fuck", "shit", "cunt", "nigg", "faggot", "rape", "nazi"];

/* ---- credentials (both naming schemes) ---- */
function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* ---- validation ---- */
function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  // Collapse all whitespace (tabs/newlines included) to single spaces, then
  // drop control chars and angle brackets by code point. Letters, digits and
  // ordinary punctuation are kept. Done by code point rather than a \u regex
  // range on purpose, so the source stays plain ASCII and unambiguous.
  const collapsed = raw.replace(/\s+/g, " ");
  let cleaned = "";
  for (const ch of collapsed) {
    const c = ch.codePointAt(0);
    if (c < 0x20 || c === 0x7f) continue; // C0 controls + DEL
    if (ch === "<" || ch === ">") continue; // XSS surface
    cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, NAME_MAX);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (PROFANITY.some((w) => lower.includes(w))) return null;
  return cleaned;
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/* ---- shape the flat zrange result into rows ---- */
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function toEntries(raw) {
  // withScores -> [member, score, member, score, ...]; the client already
  // JSON-parses object members back to objects for us
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    const m = raw[i];
    const meta = typeof m === "string" ? safeParse(m) : m;
    if (!meta) continue;
    out.push({ name: meta.n, wave: meta.w, score: Number(raw[i + 1]), t: meta.t });
  }
  return out;
}

async function readBoard(redis) {
  const raw = await redis.zrange(BOARD_KEY, 0, TOP_N - 1, {
    rev: true,
    withScores: true,
  });
  return toEntries(raw);
}

/* ---- GET: the top 10 ---- */
export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ entries: [], configured: false });
  try {
    return NextResponse.json({ entries: await readBoard(redis), configured: true });
  } catch {
    // a dead DB must not break the hero - return an empty, styled board
    return NextResponse.json({ entries: [], configured: true, error: "read_failed" });
  }
}

/* ---- POST: submit a run ---- */
export async function POST(request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const name = sanitizeName(body?.name);
  const score = body?.score;
  const wave = body?.wave;

  if (!name) {
    return NextResponse.json({ ok: false, error: "bad_name" }, { status: 400 });
  }
  // score >= 0: a run that reaches wave >= 1 but dies before scoring is still
  // a valid (humble) entry — reject only negatives / non-integers / absurd highs
  if (!isInt(score, 0, SCORE_MAX)) {
    return NextResponse.json({ ok: false, error: "bad_score" }, { status: 400 });
  }
  if (!isInt(wave, 1, WAVE_MAX)) {
    return NextResponse.json({ ok: false, error: "bad_wave" }, { status: 400 });
  }
  if (score > plausibleCeiling(wave)) {
    return NextResponse.json({ ok: false, error: "implausible" }, { status: 400 });
  }

  // per-IP rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  try {
    const rlKey = `arcade:rl:${ip}`;
    const hits = await redis.incr(rlKey);
    if (hits === 1) await redis.expire(rlKey, RL_WINDOW);
    if (hits > RL_MAX) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const member = {
      n: name,
      w: wave,
      t: Date.now(),
      id: Math.random().toString(36).slice(2, 10), // keeps identical runs distinct
    };
    await redis.zadd(BOARD_KEY, { score, member });
    await redis.zremrangebyrank(BOARD_KEY, 0, -(KEEP_N + 1)); // keep top 50

    const entries = await readBoard(redis);
    const rank = entries.findIndex((e) => e.t === member.t && e.name === name);
    return NextResponse.json({
      ok: true,
      entries,
      rank: rank >= 0 ? rank + 1 : null, // 1-based, null if it fell outside the top 10
    });
  } catch {
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
}
