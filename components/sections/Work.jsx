"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { gsap } from "@/lib/gsapClient";
import { work } from "@/lib/data";

/*
  Featured work — three engagements as deep, tactile cards on the cream base.
  GSAP owns the scroll entrances (scrubbed rise + settle); Motion owns the
  pointer physics (lift + damped tilt) on separate transforms, so they never
  fight over the same property.
*/
function WorkCard({ item }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [3.5, -3.5]), {
    stiffness: 160,
    damping: 20,
  });
  const ry = useSpring(useTransform(mx, [0, 1], [-3.5, 3.5]), {
    stiffness: 160,
    damping: 20,
  });

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.article
      data-work-card
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className="card-soft group relative overflow-hidden p-8 sm:p-12"
    >
      {/* warm bloom that follows the card's hover state */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(closest-side, rgb(236 166 73 / 0.35), transparent)",
        }}
      />

      <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="label">
              {item.org} · {item.period}
            </p>
            <span className="tag tag-ember">{item.status}</span>
          </div>
          <h3
            className="font-display text-[length:var(--step-3)] font-medium leading-[1.05] tracking-[-0.01em]"
            style={{ fontVariationSettings: "'opsz' 90, 'SOFT' 40" }}
          >
            {item.title}
          </h3>
          <p className="mt-6 max-w-xl leading-relaxed text-ink/80">{item.body}</p>
          <p className="mt-4 max-w-xl font-medium text-plum">{item.outcome}</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-8 md:items-end">
          <div className="flex flex-wrap gap-2 md:justify-end">
            {item.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          {item.link && (
            <a
              href={item.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pill pill-solid"
            >
              {item.link.label} ↗
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function Work() {
  const rootRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) return;
      gsap.utils.toArray("[data-work-card]").forEach((card) => {
        gsap.fromTo(
          card,
          { y: 90, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top 96%",
              end: "top 55%",
              scrub: 0.6,
            },
          }
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="work" ref={rootRef} className="px-6 py-28 sm:px-10 md:py-36">
      <p className="label mb-4">Featured work</p>
      <h2
        className="mb-16 max-w-3xl font-display text-[length:var(--step-3)] font-medium leading-[1.06] tracking-[-0.01em]"
        style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 50" }}
      >
        Three engines, currently earning their keep.
      </h2>

      <div className="space-y-8">
        {work.map((item) => (
          <WorkCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
