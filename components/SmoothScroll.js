"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";

// Site-wide buttery scroll (Lenis) + a global MotionConfig so every Framer
// animation honours the OS "reduce motion" setting. When the user prefers
// reduced motion we skip Lenis entirely and fall back to native scrolling —
// premium motion should never fight accessibility.
export default function SmoothScroll({ children }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const content = (
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  );

  if (reduced) return content;

  return (
    <ReactLenis
      root
      options={{ lerp: 0.1, duration: 1.15, smoothWheel: true, wheelMultiplier: 1 }}
    >
      {content}
    </ReactLenis>
  );
}
