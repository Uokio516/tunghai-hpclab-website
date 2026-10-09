import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { researchAreas } from "../data/research";
import { lab } from "../data/lab";
import { useControllableState } from "../lib/useControllableState";
import { useLocale } from "../lib/locale";

const RADIUS_PCT = 38;

function nodePosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + RADIUS_PCT * Math.cos(angle),
    y: 50 + RADIUS_PCT * Math.sin(angle),
  };
}

interface ResearchNetworkGraphProps {
  compact?: boolean;
  /* Pass both to sync this graph with a sibling (e.g. ResearchAreas) —
     hovering a node in one highlights the matching row in the other.
     Omit both to let the graph track its own hover state standalone. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
}

/* Option C from the redesign plan: a hub-and-spoke network graph where the
   six confirmed research areas (see data/research.ts) are nodes around a
   central lab hub. Shared between the Hero (here) and the future Research
   Network section (Phase 4) so the visualization isn't built twice. */
export function ResearchNetworkGraph({ compact = false, activeId: activeIdProp, onActiveChange }: ResearchNetworkGraphProps) {
  const { language, t } = useLocale();
  const [activeId, setActiveId] = useControllableState(activeIdProp, onActiveChange, null as string | null);
  const active = researchAreas.find((a) => a.id === activeId) ?? null;
  const total = researchAreas.length;
  // MotionConfig's reducedMotion="user" only suppresses transform/layout
  // animation, not SVG attributes like pathLength — checked directly here.
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  return (
    <div className={`w-full ${compact ? "" : "sm:pb-24"}`}>
      <div className="relative mx-auto hidden aspect-square w-full max-w-[620px] sm:block">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {researchAreas.map((area, i) => {
            const { x, y } = nodePosition(i, total);
            const isActive = activeId === area.id;
            const isDimmed = activeId !== null && !isActive;
            return (
              <motion.line
                key={area.id}
                x1={50}
                y1={50}
                x2={x}
                y2={y}
                stroke={isActive ? "#c9b8a0" : "rgba(255,255,255,0.18)"}
                strokeWidth={isActive ? 0.6 : 0.3}
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: isDimmed ? 0.25 : 1 }}
                transition={reduceMotion ? { duration: 0.2 } : { duration: 1, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        </svg>

        <div
          className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-center"
          style={{ left: "50%", top: "50%", borderColor: "rgba(255,255,255,0.25)", background: "rgba(5,7,11,0.8)" }}
        >
          <span className="text-[10px] font-medium uppercase leading-tight tracking-wide" style={{ color: "#f3f4f6" }}>
            {lab.shortName}
          </span>
        </div>

        {researchAreas.map((area, i) => {
          const { x, y } = nodePosition(i, total);
          const isActive = activeId === area.id;
          const isDimmed = activeId !== null && !isActive;
          return (
            <Link
              key={area.id}
              to={"/#research"}
              data-cursor-hover
              onMouseEnter={() => setActiveId(area.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(area.id)}
              onBlur={() => setActiveId(null)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition-opacity focus-visible:outline-none"
              style={{ left: `${x}%`, top: `${y}%`, opacity: isDimmed ? 0.35 : 1 }}
            >
              <span
                className="h-3 w-3 rounded-full transition-transform"
                style={{
                  background: isActive ? "#c9b8a0" : "rgba(255,255,255,0.5)",
                  transform: isActive ? "scale(1.4)" : "scale(1)",
                }}
              />
              <span
                className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.1em] sm:text-sm"
                style={{ color: "#f3f4f6", opacity: isActive ? 1 : 0.85 }}
              >
                {language === "en" ? area.titleEn : area.titleZh}
              </span>
            </Link>
          );
        })}

        {!compact && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[-72px] flex justify-center px-4 text-center">
            <p className="max-w-md text-sm leading-relaxed opacity-75 sm:text-base" style={{ color: "#f3f4f6" }}>
              {active ? (language === "en" ? active.descriptionEn : active.descriptionZh) : t("將滑鼠移到節點上，探索六大研究領域", "Hover over a node to explore our six research areas")}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {researchAreas.map((area) => (
          <Link
            key={area.id}
            to={"/#research"}
            data-cursor-hover
            className="rounded-lg border p-3"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            <p className="font-mono text-[10px] opacity-50">{area.index}</p>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#f3f4f6" }}>
              {language === "en" ? area.titleEn : area.titleZh}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
