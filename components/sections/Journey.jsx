"use client";

import { useEffect, useRef, useState } from "react";
import Snap from "lenis/snap";
import { gsap } from "@/lib/gsapClient";
import Reveal from "@/components/ui/Reveal";
import { chapters } from "@/lib/data";

const MANIFESTO = "Systems that work while you sleep.".split(" ");

/*
  Journey v2 — no scroll-jacking. The scroll stays native (Lenis-smoothed):

    - left rail (years + progress line) is position: sticky
    - right column is a stack of near-viewport-height chapter cards
    - an IntersectionObserver with a center band marks the active chapter;
      the rail year and progress line animate on that event, never on a
      scrubbed timeline
    - lenis/snap in proximity mode settles the view gently on a card when
      the user stops near one (CSS scroll-snap can't be used: the root
      scroller is animated by Lenis, and browsers apply snap to
      programmatic scrolls, so the two fight — proximity snap through
      Lenis is the equivalent behavior without the conflict)

  Reduced motion: no snap, no tweens, plain scrolling stack.
*/
export default function Journey() {
  const rootRef = useRef(null);
  const fillRef = useRef(null);
  const cardsRef = useRef([]);
  const yearsRef = useRef([]);
  const [active, setActive] = useState(0);

  // manifesto — words surface as you scroll into them (a reveal, not a pin)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
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
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // center-band observer → active chapter index
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(Number(entry.target.dataset.index));
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    cardsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // rail reacts to the active chapter (event-driven tween, not scroll-scrub)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 0.55;
    yearsRef.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        color: i === active ? "#ff7d00" : "rgb(255 236 209 / 0.45)",
        scale: i === active ? 1.06 : 1,
        duration,
        ease: "power3.out",
        overwrite: true,
      });
    });
    if (fillRef.current) {
      gsap.to(fillRef.current, {
        scaleY: (active + 1) / chapters.length,
        duration: reduced ? 0 : 0.7,
        ease: "power3.inOut",
        overwrite: true,
      });
    }
  }, [active]);

  // gentle proximity snap on the chapter cards (desktop, motion allowed)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const lenis = window.__lenis;
    if (reduced || !desktop || !lenis) return;

    const snap = new Snap(lenis, {
      type: "proximity",
      duration: 0.9,
      distanceThreshold: "35%",
      velocityThreshold: 1,
    });
    cardsRef.current.forEach((el) => el && snap.addElement(el, { align: "center" }));
    return () => snap.destroy?.();
  }, []);

  return (
    <section
      id="journey"
      ref={rootRef}
      className="relative py-20 text-cream md:py-24"
    >
      {/* atmosphere comes from the fixed BackgroundFlow layer behind */}
      <div className="shell relative">
        <p className="label label-cream mb-10">The journey</p>

        <h2
          data-manifesto
          className="mb-16 max-w-4xl font-display text-[length:var(--step-4)] font-medium leading-[1.04] tracking-[-0.015em]"
          style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 60" }}
        >
          {MANIFESTO.map((w, i) => (
            <span key={i} data-word className="mr-[0.24em] inline-block">
              {w}
            </span>
          ))}
        </h2>

        <div className="grid md:grid-cols-[12rem_1fr] md:gap-10">
          {/* sticky year rail */}
          <div className="max-md:hidden">
            <div className="sticky top-[22vh]">
              <div className="relative">
                <div className="absolute bottom-2 left-0 top-2 w-px bg-cream/15">
                  <div
                    ref={fillRef}
                    className="h-full w-px origin-top bg-orange"
                    style={{ transform: "scaleY(0.34)" }}
                  />
                </div>
                <ul className="space-y-12 pl-8">
                  {chapters.map((c, i) => (
                    <li
                      key={c.id}
                      ref={(el) => (yearsRef.current[i] = el)}
                      className="origin-left"
                      style={{ color: "rgb(255 236 209 / 0.45)" }}
                    >
                      <p
                        className="font-display text-4xl font-medium"
                        style={{ fontVariationSettings: "'opsz' 60" }}
                      >
                        {c.year}
                      </p>
                      <p className="mt-1 text-sm opacity-80">{c.title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* stacked chapters — the page scrolls, nothing is hijacked */}
          <div>
            {chapters.map((c, i) => (
              <article
                key={c.id}
                data-index={i}
                ref={(el) => (cardsRef.current[i] = el)}
                className="flex items-center py-10 md:min-h-[92svh] md:py-0"
              >
                <Reveal className="w-full" y={40}>
                  <div className="glass-dark flex w-full flex-col justify-center p-8 sm:p-12">
                    <p className="label label-cream mb-5">{c.year}</p>
                    <h3
                      className="font-display text-[length:var(--step-3)] font-medium leading-[1.05] tracking-[-0.01em]"
                      style={{ fontVariationSettings: "'opsz' 90, 'SOFT' 50" }}
                    >
                      {c.title}
                    </h3>
                    <p className="mt-6 max-w-xl text-[length:var(--step-1)] leading-relaxed text-cream/80">
                      {c.body}
                    </p>
                  </div>
                </Reveal>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
