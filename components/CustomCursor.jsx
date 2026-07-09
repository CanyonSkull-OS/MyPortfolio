"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapClient";

/*
  Custom cursor — a small ink dot with a trailing ring. The ring lags via
  gsap.quickTo (lerp, never 1:1) and swells over interactive elements.
  Only exists on fine pointers with motion allowed; touch devices and
  reduced-motion users keep the native cursor.
*/
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    document.documentElement.classList.add("has-custom-cursor");
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });

    const dotX = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });

    let shown = false;
    const onMove = (e) => {
      if (!shown) {
        shown = true;
        gsap.to([dot, ring], { opacity: 1, duration: 0.4 });
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
      const interactive = e.target.closest(
        "a, button, [role='button'], [data-cursor]"
      );
      gsap.to(ring, {
        scale: interactive ? 2.1 : 1,
        opacity: interactive ? 0.55 : 1,
        duration: 0.35,
        ease: "power3.out",
      });
      gsap.to(dot, {
        scale: interactive ? 0.5 : 1,
        duration: 0.35,
        ease: "power3.out",
      });
    };
    const onLeave = () => {
      shown = false;
      gsap.to([dot, ring], { opacity: 0, duration: 0.3 });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden="true">
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-2 w-2 rounded-full bg-ember"
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-9 w-9 rounded-full border border-ink/35 mix-blend-difference"
        style={{ borderColor: "rgb(244 239 231 / 0.9)" }}
      />
    </div>
  );
}
