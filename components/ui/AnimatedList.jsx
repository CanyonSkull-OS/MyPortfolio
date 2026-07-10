"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/*
  AnimatedList — React port of the Magic UI list. New items spring in at
  the top on an interval and the stack cycles forever. Client-only (the
  parent mounts it behind a dynamic ssr:false boundary). Under
  prefers-reduced-motion it renders the full list statically.
*/
function AnimatedListItem({ children }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, originY: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 40 }}
      layout
      className="mx-auto w-full"
    >
      {children}
    </motion.div>
  );
}

export default function AnimatedList({ items, renderItem, delay = 1500, visible = 4 }) {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setIndex((i) => i + 1), delay);
    return () => clearInterval(timer);
  }, [delay, reduced]);

  if (reduced) {
    return (
      <div className="flex flex-col gap-3">
        {items.slice(0, visible).map((item, i) => (
          <div key={i}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  // newest first, capped to `visible` rows; keys ride the running index so
  // AnimatePresence sees every cycle as a fresh item
  const shown = [];
  for (let i = 0; i < Math.min(visible, index + 1); i++) {
    const n = index - i;
    shown.push({ key: n, item: items[n % items.length] });
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {shown.map(({ key, item }) => (
          <AnimatedListItem key={key}>{renderItem(item)}</AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
}
