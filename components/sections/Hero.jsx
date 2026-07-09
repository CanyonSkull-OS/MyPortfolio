"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { gsap } from "@/lib/gsapClient";
import AuroraPill from "@/components/ui/AuroraPill";
import { identity } from "@/lib/data";

const easeOut = [0.22, 1, 0.36, 1];

/*
  Scoping: Motion owns the one-shot entrance (inner elements). GSAP owns the
  scroll-scrubbed exit drift on the [data-drift] wrappers — different nodes,
  different properties, no overlap.
*/
export default function Hero() {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // desktop-only flourish — small screens keep a stable, static hero
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
        tl.to('[data-drift="left"]', { xPercent: -7, ease: "none" }, 0)
          .to('[data-drift="right"]', { xPercent: 7, ease: "none" }, 0)
          .to(
            '[data-drift="fade"]',
            { opacity: 0, yPercent: -30, ease: "none" },
            0
          );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="top"
      ref={rootRef}
      className="relative flex min-h-svh flex-col justify-center px-6 pb-28 pt-36 sm:px-10"
    >
      {/* telemetry intro */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.35 }}
        className="telemetry mb-8 flex items-center gap-2"
      >
        <span className="live-dot" aria-hidden="true" />
        ~/omer-shahid — systems.online<span className="blink">▌</span>
      </motion.p>

      {/* display name — GSAP drifts the wrappers on scroll */}
      <h1 className="font-display uppercase leading-[0.82] tracking-tight">
        <div data-drift="left">
          <motion.span
            className="block text-[clamp(4.8rem,17.5vw,15.5rem)]"
            initial={{ opacity: 0, y: 90 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.45, ease: easeOut }}
          >
            Omer
          </motion.span>
        </div>
        <div data-drift="right">
          <motion.span
            className="block text-[clamp(4.8rem,17.5vw,15.5rem)] text-transparent [-webkit-text-stroke:2px_rgb(244_244_242/0.9)]"
            initial={{ opacity: 0, y: 90 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.58, ease: easeOut }}
          >
            Shahid
          </motion.span>
        </div>
      </h1>

      <div data-drift="fade">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.85, ease: easeOut }}
          className="mt-10 max-w-2xl"
        >
          <p className="text-lg lowercase text-ink/90 sm:text-xl">
            {identity.role} — building lead engines and workflow orchestration
            that run while you sleep.
          </p>
          <p className="mt-2 text-sm lowercase tracking-wide text-mute">
            {identity.line}
          </p>
        </motion.div>

        {/* clean, highly visible contacts */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.0, ease: easeOut }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <AuroraPill href={`mailto:${identity.email}`}>
            <span className="text-mint">✉</span> {identity.email}
          </AuroraPill>
          <AuroraPill href={`tel:${identity.phoneHref}`}>
            <span className="text-mint">☏</span> {identity.phone}
          </AuroraPill>
          <AuroraPill href={identity.linkedin} external>
            <span className="text-mint">in</span> linkedin ↗
          </AuroraPill>
        </motion.div>
      </div>

      {/* orbital corner badge — nod to the reference's curved corner text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.3 }}
        className="pointer-events-none absolute bottom-10 right-8 hidden h-28 w-28 md:block"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="orbital h-full w-full">
          <defs>
            <path
              id="orbit"
              d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
            />
          </defs>
          <text className="fill-white/40 font-mono text-[8.5px] lowercase tracking-[0.22em]">
            <textPath href="#orbit">
              automation ✲ n8n ✲ ai engineering ✲ workflows ✲
            </textPath>
          </text>
        </svg>
      </motion.div>

      {/* scroll cue */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.45 }}
        className="telemetry absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        scroll <span className="text-mint">●</span>
      </motion.p>
    </section>
  );
}
