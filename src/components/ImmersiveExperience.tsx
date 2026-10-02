import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export function ImmersiveExperience({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="route-stage"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
