"use client";

import AnimatedList from "@/components/ui/AnimatedList";

/*
  LeadFeed — a live-feed mock of the BeamHive pipeline, cycling through
  the five stages a lead actually moves through: scrape, enrich, score,
  route, sync. Sits inside the BeamHive work card on the cream section,
  so rows are ink-on-surface with palette accent chips.
*/
const events = [
  {
    icon: "🔍",
    accent: "#ff7d00",
    title: "New lead scraped",
    detail: "Source: LinkedIn",
    time: "12s ago",
  },
  {
    icon: "✨",
    accent: "#15616d",
    title: "Lead enriched",
    detail: "Company and role matched",
    time: "9s ago",
  },
  {
    icon: "📊",
    accent: "#78290f",
    title: "Lead scored",
    detail: "87/100, high intent",
    time: "6s ago",
  },
  {
    icon: "🧭",
    accent: "#15616d",
    title: "Routed to sales",
    detail: "Warm queue",
    time: "3s ago",
  },
  {
    icon: "✅",
    accent: "#ff7d00",
    title: "Synced to CRM",
    detail: "No hands touched it",
    time: "just now",
  },
];

function FeedRow(item) {
  return (
    <figure className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3 shadow-[0_2px_10px_-6px_rgb(0_21_36/0.25)]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base"
        style={{ backgroundColor: item.accent }}
        aria-hidden="true"
      >
        {item.icon}
      </div>
      <figcaption className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {item.title}
          <span className="mx-1.5 text-ink/35">·</span>
          <span className="font-normal text-mute">{item.time}</span>
        </p>
        <p className="truncate text-sm text-mute">{item.detail}</p>
      </figcaption>
    </figure>
  );
}

export default function LeadFeed() {
  return (
    <div
      aria-label="Live view of the lead pipeline"
      className="relative max-h-[15.5rem] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_62%,transparent)]"
    >
      <AnimatedList items={events} renderItem={FeedRow} delay={1500} visible={4} />
    </div>
  );
}
