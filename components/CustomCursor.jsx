"use client";

import { useEffect, useRef } from "react";

/*
  Custom cursor v2 — a solid orange dot with a thin cream ring easing just
  behind it.

  Architecture (this is what fixes the lag):
    - one requestAnimationFrame loop owns everything
    - pointer coords live in a ref; no React state, no scroll listeners
    - positions move via translate3d (GPU-composited), never top/left
    - framerate-independent lerp: dot ~0.55, ring ~0.18 (fast follow,
      slight trail — the ring can never get stranded)

  Hover: over links/buttons the ring swells and turns orange; over
  [data-cursor="view"] targets (project cards) an arrow appears inside it.
  The ring uses mix-blend-difference so it stays visible on cream.
  Touch devices and reduced-motion users keep the native cursor.
*/
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const arrowRef = useRef(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const arrow = arrowRef.current;
    document.documentElement.classList.add("has-custom-cursor");

    // all mutable state in plain refs — the raf loop is the single writer
    const target = { x: -100, y: -100 };
    const dotPos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let ringScale = 1;
    let ringScaleTarget = 1;
    let arrowOpacity = 0;
    let arrowTarget = 0;
    let shown = false;
    let last = performance.now();
    let rafId = 0;

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const kDot = 1 - Math.pow(1 - 0.55, dt * 60);
      const kRing = 1 - Math.pow(1 - 0.18, dt * 60);

      dotPos.x += (target.x - dotPos.x) * kDot;
      dotPos.y += (target.y - dotPos.y) * kDot;
      ringPos.x += (target.x - ringPos.x) * kRing;
      ringPos.y += (target.y - ringPos.y) * kRing;
      ringScale += (ringScaleTarget - ringScale) * kRing;
      arrowOpacity += (arrowTarget - arrowOpacity) * kRing;

      dot.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%) scale(${ringScale})`;
      arrow.style.opacity = arrowOpacity.toFixed(3);

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!shown) {
        shown = true;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
        // teleport both to the pointer so nothing swims in from a corner
        dotPos.x = ringPos.x = e.clientX;
        dotPos.y = ringPos.y = e.clientY;
      }
    };

    // hover states via event delegation — no per-element listeners
    const onOver = (e) => {
      const view = e.target.closest?.("[data-cursor='view']");
      const interactive = e.target.closest?.(
        "a, button, [role='button'], [data-cursor]"
      );
      if (view) {
        ringScaleTarget = 3;
        arrowTarget = 1;
        ring.style.borderColor = "var(--color-orange)";
      } else if (interactive) {
        ringScaleTarget = 1.9;
        arrowTarget = 0;
        ring.style.borderColor = "var(--color-orange)";
      } else {
        ringScaleTarget = 1;
        arrowTarget = 0;
        ring.style.borderColor = "rgb(255 236 209 / 0.9)";
      }
    };

    const onLeaveDoc = () => {
      shown = false;
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveDoc);

    return () => {
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
    };
  }, []);

  return (
    <div aria-hidden="true">
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-2 w-2 rounded-full bg-orange opacity-0"
        style={{ willChange: "transform" }}
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[90] flex h-9 w-9 items-center justify-center rounded-full border opacity-0 mix-blend-difference"
        style={{
          willChange: "transform",
          borderColor: "rgb(255 236 209 / 0.9)",
          transitionProperty: "border-color",
          transitionDuration: "300ms",
        }}
      >
        <span
          ref={arrowRef}
          className="text-[10px] leading-none text-cream"
          style={{ opacity: 0 }}
        >
          ↗
        </span>
      </div>
    </div>
  );
}
