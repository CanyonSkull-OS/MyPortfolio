"use client";

import { motion } from "motion/react";
import { identity } from "@/lib/data";

const links = [
  ["journey", "#journey"],
  ["projects", "#projects"],
  ["skills", "#skills"],
  ["contact", "#contact"],
];

export default function Nav() {
  const go = (e, hash) => {
    e.preventDefault();
    if (window.__lenis) {
      window.__lenis.scrollTo(hash, { offset: -24, duration: 1.4 });
    } else {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-1/2 top-5 z-50 w-[min(94vw,56rem)] -translate-x-1/2"
    >
      <nav className="glass-pill flex items-center justify-between px-5 py-2.5 text-sm">
        <a
          href="#top"
          onClick={(e) => go(e, "#top")}
          className="flex items-center gap-2 lowercase tracking-wide"
        >
          <span className="live-dot" aria-hidden="true" />
          omer shahid
        </a>
        <div className="hidden items-center gap-6 lowercase text-mute sm:flex">
          {links.map(([label, hash]) => (
            <a
              key={hash}
              href={hash}
              onClick={(e) => go(e, hash)}
              className="transition-colors duration-300 hover:text-ink"
            >
              {label}
            </a>
          ))}
        </div>
        <a
          href={identity.github}
          target="_blank"
          rel="noopener noreferrer"
          className="lowercase tracking-wide text-mute transition-colors duration-300 hover:text-mint"
        >
          github ↗
        </a>
      </nav>
    </motion.header>
  );
}
