import Reveal from "@/components/ui/Reveal";

/*
  recent.design-style section header: index + lowercase name on the left,
  metadata tags on the right, hairline underneath.
*/
export default function SectionHeading({ index, name, meta = [] }) {
  return (
    <Reveal className="mb-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <p className="telemetry">
          <span className="text-mint">{index}</span> / {name}
        </p>
        <div className="hidden gap-6 text-[0.6875rem] tracking-[0.06em] text-mute sm:flex">
          {meta.map(([k, v]) => (
            <p key={k}>
              <span className="text-white/35">{k}: </span>
              <span className="text-ink/80">{v}</span>
            </p>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
