"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { identity } from "@/lib/data";

const links = [
  ["Journey", "#journey"],
  ["Work", "#work"],
  ["Projects", "#projects"],
  ["Skills", "#skills"],
  ["Contact", "#contact"],
];

/*
  Nav — floats transparent over the hero's plum field (milk text), then gains
  a cream glass surface once the page scrolls into the light sections.
*/
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      className="fixed left-1/2 top-5 z-50 w-[min(94vw,58rem)] -translate-x-1/2"
    >
      <nav
        className={`flex items-center justify-between rounded-full border px-6 py-3 text-sm transition-colors duration-500 ${
          scrolled
            ? "border-ink/10 bg-cream/80 text-ink shadow-[0_8px_28px_-12px_rgb(34_22_17/0.18)] backdrop-blur-md"
            : "border-milk/15 bg-milk/5 text-milk backdrop-blur-sm"
        }`}
      >
        <a
          href="#top"
          onClick={(e) => go(e, "#top")}
          className="font-display text-base font-medium tracking-tight"
          style={{ fontVariationSettings: "'opsz' 40, 'SOFT' 50" }}
        >
          Omer Shahid
        </a>
        <div
          className={`hidden items-center gap-6 sm:flex ${
            scrolled ? "text-mute" : "text-milk/75"
          }`}
        >
          {links.map(([label, hash]) => (
            <a
              key={hash}
              href={hash}
              onClick={(e) => go(e, hash)}
              className={`transition-colors duration-300 ${
                scrolled ? "hover:text-ember" : "hover:text-amber"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
        <a
          href={`mailto:${identity.email}`}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
            scrolled
              ? "bg-ink text-cream hover:bg-ember"
              : "bg-milk text-plum-deep hover:bg-amber"
          }`}
        >
          Say hello
        </a>
      </nav>
    </motion.header>
  );
}
