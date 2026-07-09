"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { gsap, SplitText } from "@/lib/gsapClient";
import Magnetic from "@/components/ui/Magnetic";
import { identity } from "@/lib/data";

const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
});

/*
  Hero — full-viewport Warm Signal field. The CSS .hero-grainient is always
  painted underneath; HeroScene (glass droplet + fluid gradient) mounts over
  it on capable desktops. Headline is a staggered SplitText char reveal;
  scroll drifts the content out with damping.
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
      className="hero-grainient relative flex min-h-svh flex-col justify-end overflow-hidden"
    >
      <HeroScene />

      <div
        data-hero-content
        className="relative z-10 px-6 pb-16 pt-40 sm:px-10 md:pb-20"
      >
        <p data-hero-fade className="label-milk label mb-6">
          {identity.role} — {identity.line}
        </p>

        <h1
          data-hero-title
          className="split-mask max-w-5xl font-display text-[clamp(3.4rem,11vw,9.5rem)] font-medium leading-[0.98] tracking-[-0.02em] text-milk"
          style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
        >
          Omer Shahid
        </h1>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <p
            data-hero-fade
            className="max-w-xl text-balance text-[length:var(--step-1)] leading-relaxed text-milk/85"
          >
            {identity.valueProp}
          </p>

          <div data-hero-fade className="flex flex-wrap items-center gap-3">
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
                className="pill pill-milk"
              >
                LinkedIn
              </a>
            </Magnetic>
            <Magnetic strength={0.25}>
              <a
                href={identity.github}
                target="_blank"
                rel="noopener noreferrer"
                className="pill pill-milk"
              >
                GitHub
              </a>
            </Magnetic>
          </div>
        </div>

        {/* scroll cue — a quiet line, not a gimmick */}
        <div className="mt-14 flex items-center gap-4">
          <span
            data-hero-line
            className="block h-px w-24 origin-left bg-milk/40"
          />
          <span data-hero-fade className="label label-milk">
            Scroll
          </span>
        </div>
      </div>
    </section>
  );
}
