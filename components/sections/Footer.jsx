"use client";

import Reveal from "@/components/ui/Reveal";
import AuroraPill from "@/components/ui/AuroraPill";
import { identity } from "@/lib/data";

export default function Footer() {
  return (
    <footer id="contact" className="px-6 pb-12 pt-40 sm:px-10">
      <Reveal>
        <p className="telemetry mb-8">
          &gt; open.to(internships, automation_contracts){" "}
          <span className="blink text-mint">▌</span>
        </p>
        <h2 className="font-display text-[clamp(3.4rem,12vw,10.5rem)] uppercase leading-[0.85] tracking-tight">
          Let&apos;s{" "}
          <span className="text-transparent [-webkit-text-stroke:2px_rgb(244_244_242/0.85)]">
            automate
          </span>
        </h2>
      </Reveal>

      <Reveal delay={0.15} className="mt-10 flex flex-wrap items-center gap-3">
        <AuroraPill href={`mailto:${identity.email}`} className="text-base">
          <span className="text-mint">✉</span> {identity.email}
        </AuroraPill>
        <AuroraPill href={`tel:${identity.phoneHref}`}>
          <span className="text-mint">☏</span> {identity.phone}
        </AuroraPill>
        <AuroraPill href={identity.linkedin} external>
          <span className="text-mint">in</span> linkedin ↗
        </AuroraPill>
        <AuroraPill href={identity.github} external>
          <span className="text-mint">⌥</span> github ↗
        </AuroraPill>
      </Reveal>

      <Reveal delay={0.25}>
        <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs lowercase tracking-wide text-mute">
          <p>© 2026 omer shahid · karachi, pakistan</p>
          <p>
            built with next.js, gsap, lenis &amp; a grainient shader{" "}
            <span className="text-mint">●</span>
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
