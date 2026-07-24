import { motion } from "motion/react";
import { useMemo } from "react";
import { researchAreas } from "../data/research";

interface ResearchAreaBannerProps {
  activeId: string | null;
  onActiveChange?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}

/* A vertical "reel": all six areas are stacked as thin strips, and the
   whole column scrolls so the active one lands centered and expands —
   like a slot-machine reel stopping on a value (per user feedback,
   replacing the earlier single-card slide). Non-active strips stay thin
   and dim; hovering a node rolls the reel to its strip. */

export function ResearchAreaBanner({ activeId, onActiveChange, onSelect }: ResearchAreaBannerProps) {
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const compact = useMemo(() => window.matchMedia("(max-width: 639px)").matches, []);
  const H_INACTIVE = compact ? 46 : 58;
  const H_ACTIVE = compact ? 188 : 214;
  const WINDOW_H = compact ? 360 : 460;
  const activeIndex = researchAreas.findIndex((a) => a.id === activeId);
  const hasActive = activeIndex >= 0;

  // Per-strip heights depend on which one is active; offset the reel so the
  // active strip's vertical center sits at the window center (idle: center
  // the whole stack).
  const heights = researchAreas.map((_, i) => (i === activeIndex ? H_ACTIVE : H_INACTIVE));
  const tops: number[] = [];
  let acc = 0;
  for (const h of heights) {
    tops.push(acc);
    acc += h;
  }
  const totalH = acc;
  const targetCenter = hasActive ? tops[activeIndex] + heights[activeIndex] / 2 : totalH / 2;
  const y = WINDOW_H / 2 - targetCenter;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        height: WINDOW_H,
        background: "var(--glass, rgba(255,255,255,0.04))",
        border: "1px solid var(--glass-border, rgba(255,255,255,0.12))",
      }}
    >
      {/* small persistent hint so the reel reads as interactive */}
      <div className="pointer-events-none absolute left-5 top-4 z-20 text-[10px] font-medium uppercase tracking-[0.2em] opacity-40 sm:left-8">
        Research · Hover to explore
      </div>

      {/* center focus line — where the active strip lands */}
      <div
        className="pointer-events-none absolute inset-x-0 z-0"
        style={{ top: WINDOW_H / 2 - H_ACTIVE / 2, height: H_ACTIVE, background: "rgba(255,255,255,0.03)" }}
      />

      <motion.div
        animate={{ y }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 130, damping: 20 }}
        style={{ position: "absolute", inset: 0 }}
      >
        {researchAreas.map((area, i) => {
          const isActive = i === activeIndex;
          const dist = hasActive ? Math.abs(i - activeIndex) : 99;
          const opacity = isActive ? 1 : hasActive ? Math.max(0.28, 0.7 - dist * 0.16) : 0.4;
          return (
            <button
              key={area.id}
              type="button"
              className="flex w-full flex-col justify-center px-5 text-left outline-none sm:px-8"
              style={{ height: heights[i], opacity, transition: "opacity 0.3s" }}
              onMouseEnter={() => onActiveChange?.(area.id)}
              onFocus={() => onActiveChange?.(area.id)}
              onClick={() => {
                if (isActive) onSelect?.(area.id);
                else onActiveChange?.(area.id);
              }}
              aria-pressed={isActive}
              aria-label={`${area.titleZh} ${area.titleEn}`}
            >
              <div className="flex items-baseline gap-3 sm:gap-4">
                <span className="font-mono text-xs tabular-nums opacity-50">{area.index}</span>
                <span
                  className="text-lg font-medium uppercase leading-tight tracking-tight transition-colors sm:text-xl"
                  style={{ color: isActive ? "var(--brand-light, #c9b8a0)" : "inherit" }}
                >
                  {area.titleEn}
                </span>
                {!isActive && <span className="ml-auto text-xs opacity-50">{area.titleZh}</span>}
              </div>

              {isActive && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="mt-1 text-sm opacity-60">{area.titleZh}</p>
                  <p className="mt-3 max-w-md text-sm leading-relaxed opacity-80">{area.descriptionZh}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {area.keywords.map((kw) => (
                      <li key={kw} className="text-xs font-medium uppercase tracking-[0.1em]" style={{ color: "var(--brand-light, #c9b8a0)" }}>
                        {kw}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* top/bottom fade masks — sell the "reel window" look */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
        style={{ background: "linear-gradient(to bottom, var(--bg, #05070b), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16"
        style={{ background: "linear-gradient(to top, var(--bg, #05070b), transparent)" }}
      />
    </div>
  );
}
