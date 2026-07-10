"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapClient";

/*
  BackgroundFlow — one fixed ink layer behind the whole page whose light
  wells crossfade as you scroll (teal over the journey, rust toward the
  contact act), so the dark zones feel like a single flowing body of water
  instead of stacked panels. Opacity-only tweens: GPU-composited, cheap.
  The light middle zone melts over this via the .light-zone gradient.
*/
export default function BackgroundFlow() {
  const tealRef = useRef(null);
  const rustRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(tealRef.current, {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#journey",
          start: "top 80%",
          end: "top 20%",
          scrub: 0.5,
        },
      });
      gsap.to(tealRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: "#journey",
          start: "bottom 80%",
          end: "bottom 20%",
          scrub: 0.5,
        },
      });
      gsap.to(rustRef.current, {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#contact",
          start: "top 90%",
          end: "top 30%",
          scrub: 0.5,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 bg-ink">
      <div
        ref={tealRef}
        className="absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(80% 60% at 70% 30%, rgb(21 97 109 / 0.45), transparent 70%), radial-gradient(60% 50% at 15% 80%, rgb(120 41 15 / 0.28), transparent 72%)",
        }}
      />
      <div
        ref={rustRef}
        className="absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(70% 55% at 25% 25%, rgb(21 97 109 / 0.35), transparent 70%), radial-gradient(60% 55% at 80% 75%, rgb(120 41 15 / 0.45), transparent 72%)",
        }}
      />
    </div>
  );
}
