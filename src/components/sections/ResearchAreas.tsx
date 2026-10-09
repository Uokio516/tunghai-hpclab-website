import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { researchAreas } from "../../data/research";
import { useControllableState } from "../../lib/useControllableState";
import { useLocale } from "../../lib/locale";

interface ResearchAreasProps {
  /* Set false when the page already has its own heading above (e.g. the
     two-column /research layout) so the topic isn't stated twice. */
  showHeading?: boolean;
  /* Set true when nested in a layout that provides its own section padding
     (e.g. a grid column) — otherwise this renders its own full section. */
  bare?: boolean;
  /* Pass both to sync this list with a sibling (e.g. ResearchNetworkGraph)
     — hovering a row highlights the matching node in the other. Omit both
     to let the list track its own hover state standalone. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
}

/* An indexed list rather than a card grid: the six areas are a set, not a
   sequence, so the numbering is a wayfinding aid only. Hovering (or
   focusing) a row expands its description and keywords in place and dims
   the others, so one row owns attention at a time. */
export function ResearchAreas({ showHeading = true, bare = false, activeId: activeIdProp, onActiveChange }: ResearchAreasProps) {
  const { language, t } = useLocale();
  const [activeId, setActiveId] = useControllableState(activeIdProp, onActiveChange, null as string | null);
  // MotionConfig's reducedMotion="user" doesn't reach height:auto layout
  // animation, so this one is checked directly — snap instead of animate.
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  return (
    <section className={bare ? "relative" : "relative mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32"}>
      {showHeading && (
        <>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] opacity-50">Research Areas</p>
          <h2 className="mb-14 max-w-3xl text-[clamp(1.75rem,4vw,3rem)] font-medium uppercase leading-tight tracking-tight">
            {t("六大研究領域", "Six Research Areas")}
          </h2>
        </>
      )}

      <ul className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        {researchAreas.map((area) => {
          const isActive = activeId === area.id;
          const isDimmed = activeId !== null && !isActive;
          return (
            <li
              key={area.id}
              id={area.id}
              className="scroll-mt-28 border-b transition-opacity duration-300"
              style={{ borderColor: "rgba(255,255,255,0.12)", opacity: isDimmed ? 0.4 : 1 }}
              onMouseEnter={() => setActiveId(area.id)}
              onMouseLeave={() => setActiveId(null)}
            >
              <button
                type="button"
                data-cursor-hover
                aria-expanded={isActive}
                onClick={() => setActiveId(isActive ? null : area.id)}
                onFocus={() => setActiveId(area.id)}
                className="flex w-full items-baseline gap-4 py-7 text-left focus-visible:outline-none sm:gap-6"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 self-center rounded-full transition-transform"
                  style={{ background: isActive ? "#c9b8a0" : "rgba(255,255,255,0.3)", transform: isActive ? "scale(1.4)" : "scale(1)" }}
                />
                <span className="font-mono text-xs tabular-nums opacity-45 sm:text-sm">{area.index}</span>
                <span className="flex-1">
                  <span
                    className="block text-[clamp(1.35rem,3.4vw,2.5rem)] font-medium uppercase leading-tight tracking-tight transition-colors"
                    style={{ color: isActive ? "#c9b8a0" : "inherit" }}
                  >
                    {language === "en" ? area.titleEn : area.titleZh}
                  </span>
                  <span className="mt-1 block text-sm opacity-55 sm:text-base">{language === "en" ? area.titleZh : area.titleEn}</span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-5 pb-8 sm:flex-row sm:items-start sm:gap-12 sm:pl-[3.5rem]">
                      <p className="max-w-md text-base leading-relaxed opacity-80">{language === "en" ? area.descriptionEn : area.descriptionZh}</p>
                      <ul className="flex flex-wrap gap-x-4 gap-y-2 sm:max-w-sm">
                        {area.keywords.map((kw) => (
                          <li
                            key={kw}
                            className="text-xs font-medium uppercase tracking-[0.1em]"
                            style={{ color: "#c9b8a0" }}
                          >
                            {kw}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
