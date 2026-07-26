"use client";

import { useState } from "react";
import { HERO_META, HEROES } from "./characters";

/*
  CharacterSelect — the start screen shown before the arcade boots. The player
  picks one of the four fighters (each animates its idle sheet via CSS) and each
  has its own melee combo. onPick(heroKey) boots the game with that character.
*/
export default function CharacterSelect({ onPick, onExit }) {
  const [focused, setFocused] = useState(HEROES[0]);

  return (
    <div className="absolute inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink p-4">
      <div className="w-full max-w-4xl py-8 text-center">
        <p className="game-pixel mb-2 text-[10px] uppercase tracking-widest text-orange">
          ◆ Arcade
        </p>
        <h2 className="game-pixel text-lg leading-relaxed text-cream sm:text-xl">
          CHOOSE YOUR FIGHTER
        </h2>
        <p className="game-pixel mt-3 text-[9px] leading-relaxed text-cream/50">
          Each fighter has its own attack combo
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {HEROES.map((key) => {
            const m = HERO_META[key];
            const active = focused === key;
            return (
              <button
                key={key}
                onClick={() => setFocused(key)}
                onDoubleClick={() => onPick(key)}
                aria-pressed={active}
                className={`group flex flex-col items-center border-2 p-3 transition-colors ${
                  active
                    ? "border-orange bg-orange/10"
                    : "border-cream/20 bg-cream/[0.02] hover:border-cream/50"
                }`}
              >
                <div
                  className="char-idle mx-auto"
                  style={{ backgroundImage: `url(/game/chars/${key}/idle.png)` }}
                  aria-hidden
                />
                <span className="game-pixel mt-1 text-[11px] text-cream">{m.name}</span>
                <span className="game-pixel mt-1 text-[8px] text-cream/50">{m.title}</span>
                <span
                  className={`game-pixel mt-2 text-[8px] ${active ? "text-orange" : "text-teal"}`}
                >
                  {m.combo}
                </span>
              </button>
            );
          })}
        </div>

        {/* focused fighter blurb */}
        <p className="game-pixel mx-auto mt-6 min-h-[2.5rem] max-w-md text-[9px] leading-relaxed text-cream/70">
          {HERO_META[focused].blurb}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => onPick(focused)} className="game-btn game-btn-orange">
            START AS {HERO_META[focused].name} →
          </button>
          <button onClick={onExit} className="game-btn game-btn-ghost">
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
}
