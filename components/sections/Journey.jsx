"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapClient";
import SectionHeading from "@/components/ui/SectionHeading";
import { journey, identity } from "@/lib/data";

const MANIFESTO = "I build engines that work while you sleep".split(" ");

/*
  Core pillar. Everything animated here is GSAP-owned (macro scroll timeline +
  pinning + text reveal progress) — Motion never touches these nodes.
*/
export default function Journey() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // manifesto — scrubbed word-by-word reveal
      gsap.fromTo(
        "[data-word]",
        { opacity: 0.13 },
        {
          opacity: 1,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-manifesto]",
            start: "top 82%",
            end: "top 30%",
            scrub: 0.5,
          },
        }
      );

      const cards = gsap.utils.toArray("[data-jcard]");
      const lines = gsap.utils.toArray("[data-jline]");

      const mm = gsap.matchMedia();

      // desktop: pinned stage, cards swap as the user scrolls through the pin
      mm.add("(min-width: 768px)", () => {
        gsap.set(cards, { position: "absolute", inset: 0, autoAlpha: 0, y: 56 });
        gsap.set(cards[0], { autoAlpha: 1, y: 0 });
        gsap.set(lines[0], { color: "#3ef2c3", opacity: 1 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: stageRef.current,
            start: "top top+=110",
            end: "+=240%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        });

        tl.fromTo(
          barRef.current,
          { scaleY: 0 },
          { scaleY: 1, ease: "none", duration: cards.length },
          0
        );

        cards.forEach((card, i) => {
          if (i === 0) return;
          tl.to(cards[i - 1], { autoAlpha: 0, y: -56, duration: 0.32 }, i - 0.32)
            .fromTo(
              card,
              { autoAlpha: 0, y: 56 },
              { autoAlpha: 1, y: 0, duration: 0.32 },
              i - 0.08
            )
            .set(lines[i - 1], { color: "rgba(138,138,146,0.6)", opacity: 0.6 }, i - 0.2)
            .set(lines[i], { color: "#3ef2c3", opacity: 1 }, i - 0.2);
        });

        // hold the last card for a beat before unpinning
        tl.to({}, { duration: 0.4 });
      });

      // mobile: no pin — simple scroll-entrance per card (still GSAP-owned)
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
    <section id="journey" ref={rootRef} className="px-6 pt-28 sm:px-10">
      <SectionHeading
        index="01"
        name="automation journey"
        meta={[
          ["category", "automation"],
          ["style", "systems"],
          ["interaction", "scroll"],
        ]}
      />

      {/* manifesto — GSAP text reveal progress */}
      <h2
        data-manifesto
        className="mb-24 max-w-5xl font-display text-[clamp(2.6rem,7vw,5.8rem)] uppercase leading-[0.95] tracking-tight"
      >
        {MANIFESTO.map((w, i) => (
          <span key={i} data-word className="mr-[0.22em] inline-block">
            {w}
          </span>
        ))}
      </h2>

      {/* pinned stage */}
      <div ref={stageRef} className="md:min-h-[calc(100svh-110px)]">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          {/* terminal panel */}
          <div className="hairline rounded-2xl bg-black/50 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
              <p className="telemetry ml-3">omer@automation:~$ tail -f journey.log</p>
            </div>
            <div className="relative px-5 py-6">
              {/* progress rail (GSAP scales it during the pin) */}
              <div className="absolute bottom-6 left-5 top-6 w-px bg-white/10 max-md:hidden">
                <div
                  ref={barRef}
                  className="h-full w-px origin-top bg-mint"
                  style={{ transform: "scaleY(0)" }}
                />
              </div>
              <ul className="space-y-5 font-mono text-[0.8rem] leading-relaxed md:pl-6">
                {journey.map((j) => (
                  <li
                    key={j.id}
                    data-jline
                    className="text-mute opacity-60 transition-none"
                  >
                    <span className="text-white/30">[{j.period}]</span> {j.telemetry}
                  </li>
                ))}
                <li className="telemetry pt-2">
                  <span className="blink text-mint">▌</span> pipelines healthy ·
                  0 manual interventions
                </li>
              </ul>
            </div>
          </div>

          {/* swapping cards */}
          <div className="relative min-h-[30rem] md:min-h-[26rem]">
            {journey.map((j) => (
              <article
                key={j.id}
                data-jcard
                className="hairline flex flex-col justify-between gap-8 rounded-2xl bg-soot/70 p-7 backdrop-blur-sm max-md:mb-6 sm:p-9"
              >
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <p className="telemetry">
                      <span className="text-mint">{j.index}</span> / {j.org}
                    </p>
                    <span
                      className={`glass-pill px-3 py-1 text-[0.65rem] lowercase tracking-[0.14em] ${
                        j.status === "live" ? "text-mint" : "text-mute"
                      }`}
                    >
                      {j.status === "live" && (
                        <span className="live-dot mr-1.5 inline-block align-middle" />
                      )}
                      {j.status}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-5xl">
                    {j.title}
                  </h3>
                  <p className="mt-2 text-sm lowercase text-mute">{j.period}</p>
                  <p className="mt-6 max-w-xl leading-relaxed text-ink/85">
                    {j.body}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {j.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs lowercase text-mute"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {j.link && (
                    <a
                      href={j.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-pill aurora px-5 py-2.5 text-sm lowercase text-mint"
                    >
                      {j.link.label} ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* section outro telemetry */}
      <p className="telemetry mt-16 text-right">
        engine owner:{" "}
        <a
          href={identity.github}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink/70 transition-colors hover:text-mint"
        >
          @CanyonSkull-OS
        </a>
      </p>
    </section>
  );
}
