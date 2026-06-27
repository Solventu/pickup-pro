"use client";

import { motion } from "framer-motion";

// Shared fade-up reveal used across pages so every screen has the same premium
// entrance as the homepage. `Reveal` animates a single element in when it scrolls
// into view (once); `stagger`/`fadeUp` variants are for grouping children.
// Honours reduced-motion globally via the MotionConfig in SmoothScroll.

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  y = 16,
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
