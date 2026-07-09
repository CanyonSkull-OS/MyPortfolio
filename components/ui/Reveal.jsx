"use client";

import { motion } from "motion/react";

/*
  Motion.dev scope: component reveals only. GSAP never animates these nodes —
  scroll-scrubbed transforms live on separate [data-gsap] wrappers.
*/
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  once = true,
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px" }}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
