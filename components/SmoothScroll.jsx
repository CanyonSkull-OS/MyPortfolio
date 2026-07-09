"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsapClient";

/*
  Global Lenis instance driven by the GSAP ticker so Lenis, ScrollTrigger and
  every scrubbed timeline share one clock — unified scroll synchronization
  across devices, no double-raf drift.
*/
export default function SmoothScroll({ children }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      smoothWheel: !prefersReduced,
      syncTouch: false,
    });
    window.__lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);

  return children;
}
