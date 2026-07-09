"use client";

import { motion } from "motion/react";

/*
  Glass pill with the video-2 iridescent hover sweep (CSS pseudo-element) and a
  Motion micro-press. External links open explicitly in a new tab.
*/
export default function AuroraPill({
  href,
  children,
  external = false,
  className = "",
  ...rest
}) {
  return (
    <motion.a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className={`glass-pill aurora inline-flex items-center gap-2 px-5 py-2.5 text-sm lowercase tracking-wide text-ink ${className}`}
      {...rest}
    >
      {children}
    </motion.a>
  );
}
