"use client";

import { useEffect, useState } from "react";

/*
  ArcadeLeaderboard — the global Unlimited Arcade board, shown under the
  hero's Press Start button in the arcade's pixel font (Press Start 2P, the
  .game-pixel utility). Reads /api/leaderboard on mount.

  States, deliberately quiet so a dead API never breaks the hero:
    loading           -> a stable skeleton (same markup on server + first
                         client render, so no hydration mismatch)
    configured: false -> render nothing (no backend wired on this deploy)
    empty             -> "NO RUNS YET" invitation
    error             -> treated as not-configured: render nothing
    populated         -> top 5 rows
*/
export default function ArcadeLeaderboard() {
  const [state, setState] = useState({ status: "loading", entries: [] });

  useEffect(() => {
    let alive = true;
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.configured === false || data.error) {
          setState({ status: "hidden", entries: [] });
        } else {
          setState({ status: "ready", entries: (data.entries || []).slice(0, 5) });
        }
      })
      .catch(() => alive && setState({ status: "hidden", entries: [] }));
    return () => {
      alive = false;
    };
  }, []);

  if (state.status === "hidden") return null;

  return (
    <div
      data-hero-fade
      className="mt-10 max-w-sm"
      aria-label="Unlimited Arcade leaderboard"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="game-pixel text-[9px] uppercase tracking-wider text-orange">
          Unlimited Arcade
        </p>
        <p className="game-pixel text-[8px] uppercase text-cream/40">Top 5</p>
      </div>

      <div className="rounded-lg border border-cream/12 bg-ink/30 p-4 backdrop-blur-sm">
        {state.status === "loading" && <SkeletonRows />}

        {state.status === "ready" && state.entries.length === 0 && (
          <p className="game-pixel py-2 text-center text-[9px] leading-relaxed text-cream/55">
            NO RUNS YET
            <br />
            <span className="text-orange">BE THE FIRST</span>
          </p>
        )}

        {state.status === "ready" && state.entries.length > 0 && (
          <ol className="space-y-2.5">
            {state.entries.map((e, i) => (
              <li
                key={`${e.t}-${i}`}
                className="game-pixel grid grid-cols-[1.2rem_1fr_auto] items-center gap-2 text-[9px] text-cream/85"
              >
                <span className={i === 0 ? "text-orange" : "text-cream/40"}>
                  {i + 1}
                </span>
                <span className="truncate uppercase">{e.name}</span>
                <span className="text-right tabular-nums text-cream">
                  {Number(e.score).toLocaleString()}
                  <span className="ml-2 text-cream/40">
                    W{String(e.wave).padStart(2, "0")}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-3 rounded-sm bg-cream/10" />
          <div className="h-2 flex-1 rounded-sm bg-cream/10" />
          <div className="h-2 w-14 rounded-sm bg-cream/10" />
        </div>
      ))}
    </div>
  );
}
