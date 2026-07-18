"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// the whole game (KAPLAY included) stays out of the main bundle until launch
const GameMode = dynamic(() => import("./GameMode"), { ssr: false });

/*
  GameLauncher — mounts at the page root, listens for the `game:launch`
  window event (fired by the hero's Press Start), locks Lenis + body
  scroll while the arcade overlay is up, and restores them on exit.
*/
export default function GameLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const launch = () => setOpen(true);
    window.addEventListener("game:launch", launch);
    return () => window.removeEventListener("game:launch", launch);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.__lenis?.stop();
    document.body.style.overflow = "hidden";
    return () => {
      window.__lenis?.start();
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return <GameMode onExit={() => setOpen(false)} />;
}
