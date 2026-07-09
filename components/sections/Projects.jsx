"use client";

import { motion } from "motion/react";
import Reveal from "@/components/ui/Reveal";
import { projects, identity } from "@/lib/data";

/*
  Software projects — a quiet bento on the cream base. Depth comes from soft
  shadow, hover lift and a plum wash, not neon borders.
*/
function ProjectCard({ p, className = "" }) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`card-soft group relative flex flex-col justify-between overflow-hidden p-7 sm:p-9 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(70% 100% at 80% 0%, rgb(67 32 60 / 0.09), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="mb-7 flex items-baseline justify-between gap-4">
          <p className="label">{p.kicker}</p>
          <span className="tag">{p.year}</span>
        </div>
        <h3
          className="font-display text-[length:var(--step-2)] font-medium leading-[1.05] tracking-[-0.01em]"
          style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 40" }}
        >
          {p.title}
        </h3>
        <p className="mt-4 max-w-lg leading-relaxed text-ink/75">{p.body}</p>
      </div>

      <div className="relative mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-ink/8 pt-5">
        <div className="flex flex-wrap gap-2">
          {p.stack.map((s) => (
            <span key={s} className="tag">
              {s}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-5">
          <p className="text-sm text-mute">{p.role}</p>
          <a
            href={p.github}
            target="_blank"
            rel="noopener noreferrer"
            className="link-line text-sm font-medium text-ember"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </motion.article>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="px-6 pb-28 sm:px-10 md:pb-36">
      <Reveal>
        <p className="label mb-4">Software projects</p>
        <h2
          className="mb-16 max-w-3xl font-display text-[length:var(--step-3)] font-medium leading-[1.06] tracking-[-0.01em]"
          style={{ fontVariationSettings: "'opsz' 100, 'SOFT' 50" }}
        >
          Built from the metal up.
        </h2>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-3">
        <Reveal className="md:col-span-2">
          <ProjectCard p={projects[0]} className="h-full" />
        </Reveal>
        <Reveal delay={0.1}>
          <ProjectCard p={projects[1]} className="h-full" />
        </Reveal>
        <Reveal>
          <ProjectCard p={projects[2]} className="h-full" />
        </Reveal>

        {/* GitHub profile tile */}
        <Reveal delay={0.1} className="md:col-span-2">
          <motion.a
            href={identity.github}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -6 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="group relative flex h-full min-h-[13rem] flex-col justify-between overflow-hidden rounded-3xl bg-plum p-7 text-milk sm:p-9"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full opacity-40 blur-3xl transition-opacity duration-700 group-hover:opacity-80"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(236 166 73 / 0.5), transparent)",
              }}
            />
            <p className="label label-milk relative">
              Everything else lives here
            </p>
            <p
              className="relative font-display text-[length:var(--step-2)] font-medium leading-tight"
              style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 50" }}
            >
              github.com/
              <span className="text-amber transition-colors duration-500 group-hover:text-milk">
                CanyonSkull-OS
              </span>
            </p>
          </motion.a>
        </Reveal>
      </div>
    </section>
  );
}
