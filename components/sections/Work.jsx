"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { gsap } from "@/lib/gsapClient";
import SplitHeading from "@/components/ui/SplitHeading";
import { work } from "@/lib/data";

// animates on the client only, mirroring the reference <ClientOnly> boundary
const LeadFeed = dynamic(() => import("@/components/LeadFeed"), { ssr: false });

/*
  Featured work — three engagements as deep, tactile cards. GSAP owns the
  scroll entrances (varied: alternating drift direction + slight rotation,
  scrubbed rise + settle); Motion owns the pointer physics (lift + damped
  tilt) on separate transforms, so they never fight over a property.
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
    <div data-work-card>
      <motion.article
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
              "radial-gradient(closest-side, rgb(255 125 0 / 0.28), transparent)",
          }}
        />

        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="label">
                {item.org} · {item.period}
              </p>
              <span className="tag tag-orange">{item.status}</span>
            </div>
            <h3
              className="font-display text-[length:var(--step-3)] font-medium leading-[1.05] tracking-[-0.01em]"
              style={{ fontVariationSettings: "'opsz' 90, 'SOFT' 40" }}
            >
              {item.title}
            </h3>
            <p className="mt-6 max-w-xl leading-relaxed text-ink/80">{item.body}</p>
            <p className="mt-4 max-w-xl font-medium text-rust">{item.outcome}</p>
          </div>

          <div className="flex flex-col items-start justify-between gap-8 md:items-end">
            {/* the BeamHive card gets the live pipeline feed as its visual */}
            {item.id === "beamhive" && <LeadFeed />}
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
    </div>
  );
}

export default function Work() {
  const rootRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) return;
      gsap.utils.toArray("[data-work-card]").forEach((card, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        gsap.fromTo(
          card,
          { y: 80, x: 36 * dir, rotate: 1.4 * dir, opacity: 0, scale: 0.975 },
          {
            y: 0,
            x: 0,
            rotate: 0,
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
    // pt clears the seam's dusk band so the heading lands on full cream
    <section id="work" ref={rootRef} className="shell pb-20 pt-[42svh]">
      <p className="label mb-4">Featured work</p>
      <SplitHeading
        className="mb-14 max-w-3xl font-display text-[length:var(--step-3)] font-medium leading-[1.06] tracking-[-0.01em]"
        style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 50" }}
      >
        Three engines, currently earning their keep.
      </SplitHeading>

      <div className="space-y-8">
        {work.map((item) => (
          <WorkCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
