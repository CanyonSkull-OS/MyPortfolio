"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Magnetic from "@/components/ui/Magnetic";
import { identity } from "@/lib/data";

const links = [
  ["Journey", "journey"],
  ["Work", "work"],
  ["Projects", "projects"],
  ["Skills", "skills"],
  ["Contact", "contact"],
];

const navVariants = {
  hidden: { opacity: 0, y: -16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      delayChildren: 0.35,
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/*
  Nav v2 — Framer Motion throughout: staggered link mount, a layoutId
  indicator that springs between items as the active section changes
  (tracked by IntersectionObserver), hover micro-interactions, and a
  magnetic CTA. Floats cream-on-dark over the hero, gains a cream glass
  surface once the page scrolls into the light acts.
*/
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("top");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // active section — center-band observer, no scroll math
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ["top", ...links.map(([, id]) => id)].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const go = (e, id) => {
    e.preventDefault();
    const hash = `#${id}`;
    if (window.__lenis) {
      window.__lenis.scrollTo(hash, { offset: -24, duration: 1.4 });
    } else {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.header
      variants={navVariants}
      initial="hidden"
      animate="show"
      className="fixed left-1/2 top-5 z-50 w-[min(94vw,58rem)] -translate-x-1/2"
    >
      <nav
        className={`flex items-center justify-between rounded-full border px-6 py-3 text-sm transition-colors duration-500 ${
          scrolled
            ? "border-ink/10 bg-surface/85 text-ink shadow-[0_8px_28px_-12px_rgb(0_21_36/0.25)] backdrop-blur-md"
            : "border-cream/15 bg-cream/5 text-cream backdrop-blur-sm"
        }`}
      >
        <motion.a
          variants={itemVariants}
          href="#top"
          onClick={(e) => go(e, "top")}
          className="font-display text-base font-medium tracking-tight"
          style={{ fontVariationSettings: "'opsz' 40, 'SOFT' 50" }}
        >
          Omer Shahid
        </motion.a>

        <div
          className={`hidden items-center gap-6 sm:flex ${
            scrolled ? "text-mute" : "text-cream/75"
          }`}
        >
          {links.map(([label, id]) => (
            <motion.a
              key={id}
              variants={itemVariants}
              whileHover={{ y: -1 }}
              href={`#${id}`}
              onClick={(e) => go(e, id)}
              className={`nav-line relative transition-colors duration-300 ${
                activeId === id
                  ? "text-orange"
                  : scrolled
                    ? "hover:text-ink"
                    : "hover:text-cream"
              }`}
            >
              {label}
              {activeId === id && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-orange"
                />
              )}
            </motion.a>
          ))}
        </div>

        <motion.div variants={itemVariants}>
          <Magnetic strength={0.25}>
            <a
              href={`mailto:${identity.email}`}
              className={`inline-block rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
                scrolled
                  ? "bg-ink text-cream hover:bg-orange hover:text-ink"
                  : "bg-cream text-ink hover:bg-orange"
              }`}
            >
              Say hello
            </a>
          </Magnetic>
        </motion.div>
      </nav>
    </motion.header>
  );
}
