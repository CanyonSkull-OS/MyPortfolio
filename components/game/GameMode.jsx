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
  const touchFire = useRef(false);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [muted, setMuted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);

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

      // Preload the pixel font BEFORE kaplay boots. face.load() only readies
      // the FontFace object — the canvas 2D subsystem can still miss it on the
      // first draw, and kaplay caches those blank glyphs permanently (the
      // black-box labels that needed a reload). So we also: (1) fonts.load()
      // the exact px sizes kaplay renders, (2) await fonts.ready, and (3) force
      // a real fillText warm-up so the glyphs are cached before any game text.
      try {
        const face = new FontFace("pixel", "url(/game/pixel.ttf)");
        await face.load();
        document.fonts.add(face);
        await Promise.all([
          document.fonts.load("8px pixel"),
          document.fonts.load("16px pixel"),
        ]);
        await document.fonts.ready;
        const warm = document.createElement("canvas").getContext("2d");
        if (warm) {
          warm.font = "16px pixel";
          warm.fillText("ABCabc0123·×>", 0, 20);
          warm.font = "8px pixel";
          warm.fillText("ABCabc0123·×>", 0, 20);
        }
      } catch {}

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
          takeTouchFire: () => {
            const q = touchFire.current;
            touchFire.current = false;
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

  // mobile: the arcade is built for landscape. Track orientation to show a
  // rotate prompt in portrait, and best-effort lock to landscape (works on
  // Android Chrome; iOS Safari ignores orientation lock, so the prompt is
  // the dependable fallback).
  useEffect(() => {
    if (!isTouch) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    (async () => {
      try {
        await document.documentElement.requestFullscreen?.();
        await window.screen?.orientation?.lock?.("landscape");
      } catch {}
    })();
    return () => {
      mq.removeEventListener("change", sync);
      try {
        window.screen?.orientation?.unlock?.();
      } catch {}
    };
  }, [isTouch]);

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

      {/* top controls — above the rotate overlay so exit stays reachable */}
      <div className="absolute right-4 top-4 z-[70] flex items-center gap-2">
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
          WASD MOVE · LMB SWORD · SPACE FIREBALL · E READ · ESC EXIT
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
            aria-label="Sword attack"
          >
            ⚔️
          </button>
          <button
            className="game-dbtn absolute bottom-28 right-12 !h-14 !w-14 !rounded-full !text-lg"
            onPointerDown={(e) => {
              e.preventDefault();
              touchFire.current = true;
            }}
            aria-label="Cast fireball"
          >
            🔥
          </button>
        </>
      )}

      {/* mobile: rotate-to-landscape prompt */}
      {isTouch && portrait && (
        <div className="absolute inset-0 z-[65] grid place-items-center bg-ink p-8 text-center">
          <div className="game-pixel text-cream">
            <p className="mb-4 text-4xl">↻</p>
            <p className="text-sm leading-relaxed">ROTATE YOUR DEVICE</p>
            <p className="mt-3 text-[10px] leading-relaxed text-cream/60">
              THIS ADVENTURE PLAYS IN LANDSCAPE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
