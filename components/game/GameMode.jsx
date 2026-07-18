"use client";

import { useEffect, useRef, useState } from "react";

/*
  GameMode — the full-screen arcade overlay. Owns the canvas, boots
  KAPLAY + the synth lazily on mount, and renders the DOM layer: monument
  cards (site typography, real links), game-over screen, mute/exit
  controls, and touch controls on coarse pointers. Everything tears down
  on unmount (k.quit + AudioContext.close), so the scroll site resumes
  exactly where it was.
*/
export default function GameMode({ onExit }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const synthRef = useRef(null);
  const touchDir = useRef({ x: 0, y: 0 });
  const touchAttack = useRef(false);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [muted, setMuted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);

    let k = null;
    let destroyed = false;

    (async () => {
      const [{ default: kaplay }, { createSynth }, { buildGame }, { bakeWorld }, { buildWorld }] =
        await Promise.all([
          import("kaplay"),
          import("./synth"),
          import("./engine"),
          import("./assets"),
          import("./content"),
        ]);
      if (destroyed || !canvasRef.current) return;

      // bake the whole static map into one texture before the engine boots
      const world = buildWorld();
      const baked = await bakeWorld(world);
      if (destroyed || !canvasRef.current) return;

      const synth = createSynth();
      synthRef.current = synth;

      k = kaplay({
        global: false,
        canvas: canvasRef.current,
        width: 640,
        height: 360,
        letterbox: true,
        stretch: true,
        crisp: true,
        pixelDensity: 1,
        background: "#001524",
        touchToMouse: false,
        debug: false,
      });

      apiRef.current = buildGame(
        k,
        synth,
        {
          openPanel: (data) => setPanel(data),
          exit: () => onExit(),
          onGameOver: (score, hi) => setGameOver({ score, hi }),
          onReady: () => setReady(true),
          getTouchDir: () => touchDir.current,
          takeTouchAttack: () => {
            const q = touchAttack.current;
            touchAttack.current = false;
            return q;
          },
        },
        { world, baked }
      );
    })();

    const onVis = () => {
      if (!synthRef.current) return;
      if (document.hidden) synthRef.current.suspend();
      else synthRef.current.resume();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", onVis);
      try {
        synthRef.current?.dispose();
      } catch {}
      try {
        k?.quit();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // panel close (E or Esc) + mute keys live at the DOM layer
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "Escape" || e.key === "e" || e.key === "E") && panel) {
        // stopPropagation keeps kaplay's canvas handler from re-opening it
        e.stopPropagation();
        closePanel();
      }
      if ((e.key === "m" || e.key === "M") && synthRef.current) {
        const next = !synthRef.current.muted;
        synthRef.current.setMuted(next);
        setMuted(next);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  // KAPLAY listens on the canvas: refocus it after any DOM interaction
  // or the keyboard goes dead until the player clicks the game again
  const refocusCanvas = () => requestAnimationFrame(() => canvasRef.current?.focus());

  const closePanel = () => {
    setPanel(null);
    apiRef.current?.resume();
    refocusCanvas();
  };

  const toggleMute = () => {
    if (!synthRef.current) return;
    const next = !synthRef.current.muted;
    synthRef.current.setMuted(next);
    setMuted(next);
    refocusCanvas();
  };

  const restart = () => {
    setGameOver(null);
    apiRef.current?.restart();
    refocusCanvas();
  };

  const dpad = (x, y) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      touchDir.current = { x, y };
    },
    onPointerUp: () => (touchDir.current = { x: 0, y: 0 }),
    onPointerLeave: () => (touchDir.current = { x: 0, y: 0 }),
  });

  return (
    <div className="fixed inset-0 z-[100] bg-ink" role="application" aria-label="Portfolio arcade game">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-ink">
          <p className="label label-cream animate-pulse">Loading the arcade…</p>
        </div>
      )}

      {/* top controls */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          onClick={toggleMute}
          className="pill pill-cream !px-3 !py-2 text-sm"
          aria-label={muted ? "Unmute sound" : "Mute sound"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={onExit} className="pill pill-cream !px-4 !py-2 text-sm">
          Exit ✕
        </button>
      </div>

      {/* desktop hint — top center, clear of the canvas objective text */}
      {!isTouch && (
        <p className="game-pixel pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-cream/60">
          WASD MOVE · SPACE SWING · E READ/CLOSE · M MUTE · ESC EXIT
        </p>
      )}

      {/* monument card — pixel panel, not the site's card style */}
      {panel && (
        <div
          className="absolute inset-0 grid place-items-center bg-ink/70 p-4"
          onClick={closePanel}
        >
          <article
            className="game-card w-full max-w-md p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="game-pixel mb-4 text-[10px] uppercase text-orange">
              ◆ {panel.kicker}
            </p>
            <h3 className="game-pixel text-base leading-relaxed text-cream sm:text-lg">
              {panel.title.toUpperCase()}
            </h3>
            <p className="mt-4 font-mono text-[13px] leading-relaxed text-cream/80">
              {panel.body}
            </p>
            {panel.tags && (
              <div className="mt-5 flex flex-wrap gap-2">
                {panel.tags.map((t) => (
                  <span key={t} className="game-tag">
                    {t.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            {panel.links && (
              <div className="mt-6 flex flex-wrap gap-3">
                {panel.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-btn game-btn-orange"
                  >
                    {l.label.toUpperCase()} ↗
                  </a>
                ))}
              </div>
            )}
            <button onClick={closePanel} className="game-btn game-btn-ghost mt-7">
              [E] CLOSE
            </button>
          </article>
        </div>
      )}

      {/* game over — same pixel treatment */}
      {gameOver && (
        <div className="absolute inset-0 grid place-items-center bg-ink/80 p-4">
          <div className="game-card max-w-sm p-8 text-center">
            <p className="game-pixel mb-3 text-[10px] uppercase text-orange">Game over</p>
            <h3 className="game-pixel text-lg leading-relaxed text-cream">
              YOU GOT
              <br />
              AUTOMATED
            </h3>
            <p className="game-pixel mt-5 text-[10px] text-cream/80">
              SCORE <span className="text-orange">{gameOver.score}</span> · BEST {gameOver.hi}
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button onClick={restart} className="game-btn">
                RUN IT BACK
              </button>
              <button onClick={onExit} className="game-btn game-btn-ghost">
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* touch controls */}
      {isTouch && ready && !panel && !gameOver && (
        <>
          <div className="absolute bottom-6 left-6 grid grid-cols-3 gap-1 select-none touch-none">
            <span />
            <button className="game-dbtn" {...dpad(0, -1)} aria-label="Up">▲</button>
            <span />
            <button className="game-dbtn" {...dpad(-1, 0)} aria-label="Left">◀</button>
            <span />
            <button className="game-dbtn" {...dpad(1, 0)} aria-label="Right">▶</button>
            <span />
            <button className="game-dbtn" {...dpad(0, 1)} aria-label="Down">▼</button>
            <span />
          </div>
          <button
            className="game-dbtn absolute bottom-9 right-8 !h-16 !w-16 !rounded-full !text-lg"
            onPointerDown={(e) => {
              e.preventDefault();
              touchAttack.current = true;
            }}
            aria-label="Attack"
          >
            ⚔️
          </button>
        </>
      )}
    </div>
  );
}
