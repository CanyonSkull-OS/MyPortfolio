"use client";

import { motion } from "motion/react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { projects, identity } from "@/lib/data";

const GLOW = {
  iris: "bg-[radial-gradient(120%_90%_at_85%_0%,rgb(139_92_246/0.20),transparent_60%)]",
  cyanic: "bg-[radial-gradient(120%_90%_at_85%_0%,rgb(34_211_238/0.16),transparent_60%)]",
  orchid: "bg-[radial-gradient(120%_90%_at_85%_0%,rgb(232_121_249/0.16),transparent_60%)]",
};

function ProjectCard({ p, className = "" }) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`iri-card group relative flex flex-col justify-between overflow-hidden p-7 sm:p-8 ${className}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100 ${GLOW[p.hue]}`}
      />
      <div className="relative">
        <div className="mb-7 flex items-center justify-between">
          <span className="glass-pill px-3 py-1 text-[0.65rem] tracking-[0.14em] text-mute">
            {p.year}
          </span>
          <p className="telemetry">{p.kicker}</p>
        </div>
        <h3 className="font-display text-3xl uppercase leading-[0.95] tracking-tight sm:text-4xl">
          {p.title}
        </h3>
        <p className="mt-5 max-w-lg leading-relaxed text-ink/80">{p.body}</p>
      </div>

      <div className="relative mt-9 space-y-5">
        <div className="flex flex-wrap gap-2">
          {p.stack.map((s) => (
            <span
              key={s}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-mute"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="meta-row text-mute">
          <p>
            <span className="text-white/35">role: </span>
            {p.role}
          </p>
          {/* instant, explicit outbound link */}
          <a
            href={p.github}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-pill aurora -my-1.5 px-4 py-1.5 lowercase text-ink transition-colors hover:text-mint"
          >
            github ↗
          </a>
        </div>
      </div>
    </motion.article>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="px-6 pt-36 sm:px-10">
      <SectionHeading
        index="02"
        name="projects"
        meta={[
          ["category", "software"],
          ["style", "bento"],
          ["color", "dark · vibrant"],
        ]}
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Reveal className="md:col-span-2">
          <ProjectCard p={projects[0]} className="h-full" />
        </Reveal>
        <Reveal delay={0.12}>
          <ProjectCard p={projects[1]} className="h-full" />
        </Reveal>
        <Reveal>
          <ProjectCard p={projects[2]} className="h-full" />
        </Reveal>

        {/* github profile tile */}
        <Reveal delay={0.12} className="md:col-span-2">
          <motion.a
            href={identity.github}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -6 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="iri-card group flex h-full min-h-[13rem] flex-col justify-between p-7 sm:p-8"
          >
            <p className="telemetry">
              more shenanigans <span className="text-mint">→</span>
            </p>
            <div className="flex items-end justify-between">
              <p className="font-display text-3xl uppercase leading-none tracking-tight sm:text-4xl">
                github
                <span className="block text-mute transition-colors duration-500 group-hover:text-mint">
                  /CanyonSkull-OS
                </span>
              </p>
              <span
                aria-hidden="true"
                className="font-display text-6xl text-white/15 transition-colors duration-500 group-hover:text-white/40"
              >
                ✲
              </span>
            </div>
          </motion.a>
        </Reveal>
      </div>
    </section>
  );
}
