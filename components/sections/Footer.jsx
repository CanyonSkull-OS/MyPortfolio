"use client";

import Reveal from "@/components/ui/Reveal";
import SplitHeading from "@/components/ui/SplitHeading";
import Magnetic from "@/components/ui/Magnetic";
import { identity } from "@/lib/data";

/*
  Contact — the closing act, transparent over the fixed ink field (the
  BackgroundFlow rust well fades in behind it). One big serif invitation,
  magnetic CTAs, honest credit line.
*/
export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative px-6 pb-10 pt-28 text-cream sm:px-10 md:pt-36"
    >
      <div className="relative">
        <Reveal>
          <p className="label label-cream mb-8">
            Open to internships and automation contracts
          </p>
        </Reveal>
        <SplitHeading
          className="max-w-4xl font-display text-[clamp(3rem,9.5vw,8.5rem)] font-medium leading-[1.0] tracking-[-0.02em]"
          style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 60, 'WONK' 1" }}
        >
          Let&rsquo;s work <span className="text-orange">together.</span>
        </SplitHeading>

        <Reveal delay={0.15} className="mt-12 flex flex-wrap items-center gap-3">
          <Magnetic>
            <a href={`mailto:${identity.email}`} className="pill pill-invert">
              {identity.email}
            </a>
          </Magnetic>
          <Magnetic strength={0.25}>
            <a href={`tel:${identity.phoneHref}`} className="pill pill-cream">
              {identity.phone}
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
        </Reveal>

        <Reveal delay={0.25}>
          <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-cream/12 pt-6 text-sm text-cream/55">
            <p>© 2026 Omer Shahid · Karachi, Pakistan</p>
            <p>Built with Next.js, GSAP, Lenis and one glass droplet</p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
