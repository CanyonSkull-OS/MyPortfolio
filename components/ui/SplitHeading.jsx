"use client";

import { useEffect, useRef } from "react";
import { gsap, SplitText } from "@/lib/gsapClient";

/*
  Section headline with a masked word-rise SplitText reveal on scroll-in,
  plus a whisper of parallax so headings drift against the background at
  the section seams. Reduced motion: renders static.
*/
export default function SplitHeading({
  as: Tag = "h2",
  children,
  className = "",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const split = new SplitText(ref.current, {
        type: "words,lines",
        linesClass: "line-mask",
        mask: "lines",
      });
      gsap.from(split.words, {
        yPercent: 110,
        duration: 1.1,
        ease: "expo.out",
        stagger: 0.055,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
      // seam parallax — heading drifts slightly slower than the page
      gsap.fromTo(
        ref.current,
        { yPercent: 8 },
        {
          yPercent: -4,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <Tag ref={ref} className={`split-mask ${className}`} style={style}>
      {children}
    </Tag>
  );
}
