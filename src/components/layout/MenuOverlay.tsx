import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { X } from "lucide-react";
import { navItems } from "../../lib/constants";

interface MenuOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function MenuOverlay({ open, onClose }: MenuOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="主選單"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mobile-menu-overlay fixed inset-0 z-[10030] overflow-y-auto px-5 sm:px-10"
          style={{ background: "rgba(5,7,11,0.97)", backdropFilter: "blur(12px)" }}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: "rgba(255,255,255,0.22)", color: "#f3f4f6", background: "rgba(5,7,11,0.82)" }}
            aria-label="關閉選單"
          >
            <X size={19} />
          </button>
          <nav className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-1 py-20" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item, i) => (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.07 * i, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  data-cursor-hover
                  className="mobile-menu-link group flex items-baseline gap-3 border-b py-3 transition-colors sm:gap-4 sm:py-4"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#f3f4f6" }}
                >
                  <span className="font-mono text-xs opacity-40">{item.index}</span>
                  <span className="text-[clamp(1.25rem,7vw,3rem)] font-medium uppercase tracking-tight transition-transform group-hover:translate-x-2">
                    {item.labelEn}
                  </span>
                  <span className="ml-auto hidden text-xs uppercase tracking-[0.15em] opacity-40 sm:inline">
                    {item.labelZh}
                  </span>
                </Link>
              </motion.div>
            ))}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
