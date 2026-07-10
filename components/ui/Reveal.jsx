"use client";

import { motion, useReducedMotion } from "motion/react";

/*
  Motion.dev scope: component reveals only. GSAP never animates these nodes —
  scroll-scrubbed transforms live on separate [data-gsap] wrappers.
  Accepts x / rotate / scale so grids can vary entrance direction instead of
  uniform fade-ups. Reduced motion: content renders in place, no hidden state.
*/
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  x = 0,
  rotate = 0,
  scale = 1,
  once = true,
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, x, rotate, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      viewport={{ once, margin: "-12% 0px" }}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
