"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Single registration point — every client component imports gsap from here so
// plugins are registered exactly once.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };
