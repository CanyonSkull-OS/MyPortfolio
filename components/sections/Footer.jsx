"use client";

import Reveal from "@/components/ui/Reveal";
import Magnetic from "@/components/ui/Magnetic";
import { identity } from "@/lib/data";

/*
  Contact — the warm closing act, back on deep plum so the page ends where
  it began. One big serif invitation, magnetic CTAs, honest credit line.
*/
export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-plum-deep px-6 pb-10 pt-32 text-milk sm:px-10 md:pt-40"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 20% 20%, rgb(236 166 73 / 0.14), transparent 70%), radial-gradient(55% 50% at 85% 80%, rgb(194 78 39 / 0.18), transparent 72%)",
        }}
      />

      <div className="relative">
        <Reveal>
          <p className="label label-milk mb-8">
            Open to internships and automation contracts
          </p>
          <h2
            className="max-w-4xl font-display text-[clamp(3rem,9.5vw,8.5rem)] font-medium leading-[1.0] tracking-[-0.02em]"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 60, 'WONK' 1" }}
          >
            Let&rsquo;s work <span className="text-amber">together.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.15} className="mt-12 flex flex-wrap items-center gap-3">
          <Magnetic>
            <a href={`mailto:${identity.email}`} className="pill pill-invert">
              {identity.email}
            </a>
          </Magnetic>
          <Magnetic strength={0.25}>
            <a href={`tel:${identity.phoneHref}`} className="pill pill-milk">
              {identity.phone}
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
        </Reveal>

        <Reveal delay={0.25}>
          <div className="mt-28 flex flex-wrap items-center justify-between gap-4 border-t border-milk/12 pt-6 text-sm text-milk/55">
            <p>© 2026 Omer Shahid · Karachi, Pakistan</p>
            <p>Built with Next.js, GSAP, Lenis and one glass droplet</p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
