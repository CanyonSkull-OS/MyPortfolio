"use client";

import { useRef } from "react";
import AnimatedBeam from "@/components/ui/AnimatedBeam";
import { icons } from "@/lib/icons";

/*
  HeroBeam — the hero's centerpiece. The tools I actually orchestrate
  (Slack, Gmail, Google Calendar / OpenAI, Firestore, Postgres) beam into
  one n8n automation hub. SVG beams + static chips: this is the cheap
  replacement for the old WebGL droplet.

  Palette: cream chips, ink icons; the hub goes orange. Beams pulse
  orange→teal over a faint cream path.
*/
function Node({ nodeRef, icon, label, hub = false }) {
  return (
    <div
      ref={nodeRef}
      title={label}
      className={
        hub
          ? "z-10 flex size-16 items-center justify-center rounded-full border border-orange/50 bg-cream shadow-[0_0_36px_-6px_rgb(255_125_0/0.55)]"
          : "z-10 flex size-12 items-center justify-center rounded-full border border-cream/20 bg-cream/95 shadow-[0_6px_20px_-8px_rgb(0_21_36/0.8)]"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={hub ? "size-8" : "size-5"}
        fill={hub ? "var(--color-orange)" : "var(--color-ink)"}
        role="img"
        aria-label={label}
      >
        <path d={icon} />
      </svg>
    </div>
  );
}

export default function HeroBeam() {
  const containerRef = useRef(null);
  const hubRef = useRef(null);
  const slackRef = useRef(null);
  const gmailRef = useRef(null);
  const calendarRef = useRef(null);
  const openaiRef = useRef(null);
  const firebaseRef = useRef(null);
  const postgresRef = useRef(null);

  const beam = {
    containerRef,
    toRef: hubRef,
    pathColor: "#ffecd1",
    pathOpacity: 0.2,
    pathWidth: 2,
    gradientStartColor: "#ff7d00",
    gradientStopColor: "#15616d",
    duration: 4,
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-[19rem] w-full max-w-[31rem] items-center justify-between px-2 sm:h-[21rem]"
    >
      {/* beams first so chips paint over them */}
      <AnimatedBeam {...beam} fromRef={slackRef} curvature={75} delay={0} />
      <AnimatedBeam {...beam} fromRef={gmailRef} curvature={0} delay={1.4} />
      <AnimatedBeam {...beam} fromRef={calendarRef} curvature={-75} delay={2.8} />
      <AnimatedBeam {...beam} fromRef={openaiRef} curvature={75} reverse delay={0.7} />
      <AnimatedBeam {...beam} fromRef={firebaseRef} curvature={0} reverse delay={2.1} />
      <AnimatedBeam {...beam} fromRef={postgresRef} curvature={-75} reverse delay={3.5} />

      <div className="flex h-full flex-col justify-between py-2">
        <Node nodeRef={slackRef} icon={icons.slack} label="Slack" />
        <Node nodeRef={gmailRef} icon={icons.gmail} label="Gmail" />
        <Node nodeRef={calendarRef} icon={icons.googleCalendar} label="Google Calendar" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <Node nodeRef={hubRef} icon={icons.n8n} label="n8n automation hub" hub />
        <span className="tag tag-cream">n8n core</span>
      </div>

      <div className="flex h-full flex-col justify-between py-2">
        <Node nodeRef={openaiRef} icon={icons.openai} label="OpenAI" />
        <Node nodeRef={firebaseRef} icon={icons.firebase} label="Firestore" />
        <Node nodeRef={postgresRef} icon={icons.postgresql} label="PostgreSQL" />
      </div>
    </div>
  );
}
