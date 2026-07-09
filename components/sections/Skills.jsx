"use client";

import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { skills, marquee } from "@/lib/data";

export default function Skills() {
  const clusters = skills.filter((s) => !s.featured);
  const featured = skills.find((s) => s.featured);

  return (
    <section id="skills" className="pt-36">
      {/* full-bleed marquee strip */}
      <Reveal>
        <div className="hairline overflow-hidden border-x-0 py-4">
          <div className="marquee-track flex w-max gap-8 whitespace-nowrap">
            {[...marquee, ...marquee].map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-8 font-mono text-sm lowercase tracking-[0.18em] text-mute"
              >
                {m} <span className="text-mint/70">✲</span>
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="px-6 pt-24 sm:px-10">
        <SectionHeading
          index="03"
          name="technical skillset"
          meta={[
            ["category", "stack"],
            ["style", "curated"],
            ["interaction", "hover"],
          ]}
        />

        <div className="grid gap-5 md:grid-cols-2">
          {clusters.map((c, ci) => (
            <Reveal key={c.label} delay={ci * 0.1}>
              <div className="hairline h-full rounded-2xl bg-soot/60 p-7 backdrop-blur-sm sm:p-8">
                <p className="telemetry mb-6">{c.label}</p>
                <div className="flex flex-wrap gap-2.5">
                  {c.items.map((item) => (
                    <span
                      key={item}
                      className="glass-pill aurora px-4 py-2 text-sm text-ink/90"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}

          {/* the specialization — full-width feature card */}
          <Reveal className="md:col-span-2">
            <div className="iri-card flex flex-col justify-between gap-8 p-8 sm:flex-row sm:items-end sm:p-10">
              <div>
                <p className="telemetry mb-5 flex items-center gap-2">
                  <span className="live-dot" aria-hidden="true" />
                  {featured.label} · always-on
                </p>
                <p className="font-display text-4xl uppercase leading-[0.92] tracking-tight sm:text-6xl">
                  n8n
                  <span className="block text-white/45">
                    expert workflow management
                  </span>
                </p>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-mute">
                the engine behind the journey above — deep orchestrations,
                webhook meshes, api glue and gpt pipelines, composed as
                workflows that never ask for attention.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
