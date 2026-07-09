"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapClient";
import { chapters } from "@/lib/data";

const MANIFESTO = "Systems that work while you sleep.".split(" ");

/*
  Journey — the page's dark middle act, on deep plum instead of black.
  A scrubbed word-by-word manifesto, then a pinned stage where three
  narrative chapters swap as the visitor scrolls through the pin.
  All nodes here are GSAP-owned.
*/
export default function Journey() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const railRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduced) return; // static layout is fully readable as-is

      // manifesto — words surface from 15% opacity as you scroll into them
      gsap.fromTo(
        "[data-word]",
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-manifesto]",
            start: "top 80%",
            end: "top 32%",
            scrub: 0.5,
          },
        }
      );

      const cards = gsap.utils.toArray("[data-chapter]");
      const years = gsap.utils.toArray("[data-year]");
      const mm = gsap.matchMedia();

      // desktop: pinned stage, chapters swap through the pin
      mm.add("(min-width: 768px)", () => {
        gsap.set(cards, { position: "absolute", inset: 0, autoAlpha: 0, y: 60 });
        gsap.set(cards[0], { autoAlpha: 1, y: 0 });
        gsap.set(years[0], { opacity: 1, color: "#eca649" });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: stageRef.current,
            start: "top top+=96",
            end: "+=220%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        });

        tl.fromTo(
          railRef.current,
          { scaleY: 0 },
          { scaleY: 1, ease: "none", duration: cards.length },
          0
        );

        cards.forEach((card, i) => {
          if (i === 0) return;
          tl.to(cards[i - 1], { autoAlpha: 0, y: -60, duration: 0.32 }, i - 0.32)
            .fromTo(
              card,
              { autoAlpha: 0, y: 60 },
              { autoAlpha: 1, y: 0, duration: 0.32 },
              i - 0.08
            )
            .set(years[i - 1], { opacity: 0.45, color: "#f6ede3" }, i - 0.2)
            .set(years[i], { opacity: 1, color: "#eca649" }, i - 0.2);
        });

        tl.to({}, { duration: 0.4 }); // hold the last chapter before unpinning
      });

      // mobile: no pin, simple entrances
      mm.add("(max-width: 767px)", () => {
        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 44 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: card, start: "top 85%", once: true },
            }
          );
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="journey"
      ref={rootRef}
      className="relative bg-plum-deep px-6 py-28 text-milk sm:px-10 md:py-36"
    >
      {/* soft amber wells so the plum never reads flat */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(50% 38% at 82% 8%, rgb(236 166 73 / 0.13), transparent 70%), radial-gradient(46% 40% at 10% 92%, rgb(194 78 39 / 0.16), transparent 72%)",
        }}
      />

      <div className="relative">
        <p className="label label-milk mb-10">The journey</p>

        <h2
          data-manifesto
          className="mb-24 max-w-4xl font-display text-[length:var(--step-4)] font-medium leading-[1.04] tracking-[-0.015em]"
          style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 60" }}
        >
          {MANIFESTO.map((w, i) => (
            <span key={i} data-word className="mr-[0.24em] inline-block">
              {w}
            </span>
          ))}
        </h2>

        {/* pinned stage */}
        <div ref={stageRef} className="md:min-h-[calc(100svh-96px)]">
          <div className="grid gap-12 md:grid-cols-[0.75fr_1.25fr] md:items-start">
            {/* year rail */}
            <div className="relative max-md:hidden">
              <div className="absolute bottom-2 left-0 top-2 w-px bg-milk/15">
                <div
                  ref={railRef}
                  className="h-full w-px origin-top bg-amber"
                  style={{ transform: "scaleY(0)" }}
                />
              </div>
              <ul className="space-y-12 pl-8">
                {chapters.map((c) => (
                  <li key={c.id} data-year className="opacity-45">
                    <p
                      className="font-display text-4xl font-medium"
                      style={{ fontVariationSettings: "'opsz' 60" }}
                    >
                      {c.year}
                    </p>
                    <p className="mt-1 text-sm text-milk/70">{c.title}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* swapping chapters */}
            <div className="relative min-h-[24rem] md:min-h-[22rem]">
              {chapters.map((c) => (
                <article
                  key={c.id}
                  data-chapter
                  className="glass-plum flex flex-col justify-center p-8 max-md:mb-6 sm:p-12"
                >
                  <p className="label label-milk mb-5">{c.year}</p>
                  <h3
                    className="font-display text-[length:var(--step-3)] font-medium leading-[1.05] tracking-[-0.01em]"
                    style={{ fontVariationSettings: "'opsz' 90, 'SOFT' 50" }}
                  >
                    {c.title}
                  </h3>
                  <p className="mt-6 max-w-xl text-[length:var(--step-1)] leading-relaxed text-milk/80">
                    {c.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
