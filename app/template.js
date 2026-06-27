"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Route-change transition. Unlike layout.js, a template re-mounts on every
// navigation, so this fade-up fires each time the user moves between pages —
// the small touch that makes navigation feel intentional instead of a hard cut.
// Keyed by pathname so re-renders within the same route don't replay it.
// Reduced-motion is honoured globally via the MotionConfig in SmoothScroll.
export default function Template({ children }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
