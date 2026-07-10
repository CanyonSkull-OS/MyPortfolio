"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapClient";

/* Thin orange page-progress bar along the top edge, scrubbed by scroll. */
export default function ScrollProgress() {
  const barRef = useRef(null);

  useEffect(() => {
    const tween = gsap.to(barRef.current, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-orange"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
