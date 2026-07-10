"use client";

import { useEffect, useRef } from "react";
import Reveal from "@/components/ui/Reveal";
import SplitHeading from "@/components/ui/SplitHeading";
import { gsap } from "@/lib/gsapClient";
import { skills } from "@/lib/data";

/*
  Technical skillset — editorial index rows instead of labeled cards.
  Each row underlines itself on scroll-in; items warm to rust on hover.
  The n8n specialization gets the full-width closing statement.
*/
export default function Skills() {
  const rootRef = useRef(null);
  const clusters = skills.filter((s) => !s.featured);
  const featured = skills.find((s) => s.featured);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) return;
      gsap.utils.toArray("[data-rule]").forEach((rule) => {
        gsap.fromTo(
          rule,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1.4,
            ease: "power4.inOut",
            scrollTrigger: { trigger: rule, start: "top 88%", once: true },
          }
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    // pb clears the bottom seam so the n8n note stays on full cream
    <section id="skills" ref={rootRef} className="px-6 pb-[42svh] sm:px-10">
      <p className="label mb-4">Technical skillset</p>
      <SplitHeading
        className="mb-12 max-w-3xl font-display text-[length:var(--step-3)] font-medium leading-[1.06] tracking-[-0.01em]"
        style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 50" }}
      >
        The toolbox, honestly listed.
      </SplitHeading>

      <div>
        {clusters.map((c, ci) => (
          <Reveal key={c.label} delay={ci * 0.08}>
            <div className="grid gap-4 py-8 md:grid-cols-[16rem_1fr] md:items-baseline">
              <p className="label">{c.label}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {c.items.map((item) => (
                  <span
                    key={item}
                    className="text-[length:var(--step-1)] text-ink/70 transition-colors duration-300 hover:text-rust"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div
              data-rule
              className="h-px w-full origin-left bg-ink/12"
              aria-hidden="true"
            />
          </Reveal>
        ))}

        {/* the specialization */}
        <Reveal>
          <div className="grid gap-6 py-10 md:grid-cols-[16rem_1fr] md:items-start">
            <p className="label">{featured.label}</p>
            <div>
              <p
                className="font-display text-[length:var(--step-3)] font-medium leading-none text-teal"
                style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 60" }}
              >
                n8n<span className="text-orange">.</span>
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-mute">
                {featured.note}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
