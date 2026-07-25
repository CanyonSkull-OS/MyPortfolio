"use client";

import { useEffect, useRef } from "react";
import { gsap, SplitText } from "@/lib/gsapClient";
import Magnetic from "@/components/ui/Magnetic";
import HeroBeam from "@/components/HeroBeam";
import ArcadeLeaderboard from "@/components/ArcadeLeaderboard";
import { identity } from "@/lib/data";

/*
  Hero — full-viewport Deep Water field, all CSS: the .hero-liquid gradient
  (static radials + two transform-only drifting glows) replaced the old
  WebGL droplet scene. The centerpiece is the AnimatedBeam integration
  graphic. Headline is a staggered SplitText char reveal; scroll drifts the
  content out with damping. The bottom edge fades into the fixed ink field
  so the hero melts into the journey.
*/
export default function Hero() {
  const rootRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set("[data-hero-fade], [data-hero-line]", { opacity: 1, y: 0 });
        return;
      }

      // headline — staggered char rise inside line masks
      const split = new SplitText("[data-hero-title]", {
        type: "chars,lines",
        linesClass: "line-mask",
        mask: "lines",
      });
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(split.chars, {
        yPercent: 110,
        rotate: 4,
        duration: 1.3,
        stagger: 0.028,
        delay: 0.25,
      })
        .from(
          "[data-hero-fade]",
          { opacity: 0, y: 28, duration: 1.1, stagger: 0.12 },
          "-=0.75"
        )
        .from(
          "[data-hero-line]",
          { scaleX: 0, duration: 1.2, ease: "power4.inOut" },
          "-=0.9"
        );

      // scroll exit — content drifts up and thins out, scrubbed
      gsap.to("[data-hero-content]", {
        yPercent: -18,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom 30%",
          scrub: 0.7,
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="top"
      ref={rootRef}
      className="hero-liquid relative flex min-h-svh flex-col overflow-hidden"
    >
      {/* melt into the ink field below — no hard edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-b from-transparent to-ink"
      />

      {/* two columns, both centered in the viewport: the name anchors the
          left, the beam supports on the right; stacks name-first on mobile */}
      <div
        data-hero-content
        className="shell relative z-10 grid flex-1 items-center gap-12 pb-6 pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pt-24"
      >
        <div>
          <p data-hero-fade className="label-cream label mb-6">
            {identity.role} — {identity.line}
          </p>

          <h1
            data-hero-title
            className="split-mask font-display text-[clamp(3.4rem,8vw,8.5rem)] font-medium leading-[0.98] tracking-[-0.02em] text-cream"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
          >
            Omer Shahid
          </h1>

          <p
            data-hero-fade
            className="mt-8 max-w-xl text-balance text-[length:var(--step-1)] leading-relaxed text-cream/85"
          >
            {identity.valueProp}
          </p>

          <div data-hero-fade className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("game:launch"))}
                className="pill pill-start"
              >
                ▶ Press Start
              </button>
            </Magnetic>
            <Magnetic>
              <a href={`mailto:${identity.email}`} className="pill pill-invert">
                Get in touch
              </a>
            </Magnetic>
            <Magnetic strength={0.25}>
              <a
                href={identity.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="pill pill-cream"
              >
                LinkedIn
              </a>
            </Magnetic>
            <Magnetic strength={0.25}>
              <a
                href={identity.github}
                target="_blank"
                rel="noopener noreferrer"
                className="pill pill-cream"
              >
                GitHub
              </a>
            </Magnetic>
          </div>

          <ArcadeLeaderboard />
        </div>

        <div data-hero-fade className="flex justify-center lg:justify-end lg:pr-[2vw]">
          <HeroBeam />
        </div>
      </div>

      {/* scroll cue — stays anchored at the hero's bottom edge */}
      <div className="shell relative z-10 flex items-center gap-4 pb-10">
        <span
          data-hero-line
          className="block h-px w-24 origin-left bg-cream/40"
        />
        <span data-hero-fade className="label label-cream">
          Scroll
        </span>
      </div>
    </section>
  );
}
