import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { HeroScene3D } from "./HeroScene3D";
import { CustomCursor } from "./CustomCursor";
import { Navigation } from "./layout/Navigation";
import { Footer } from "./layout/Footer";
import { WebGLBoundary } from "./ui/WebGLBoundary";
import { ResearchNetworkGraph } from "./ResearchNetworkGraph";
import { PhilosophySection } from "./sections/PhilosophySection";
import { ResearchAreas } from "./sections/ResearchAreas";
import { FeaturedProjects } from "./sections/FeaturedProjects";
import { lab } from "../data/lab";
import { heroKeywords } from "../lib/constants";
import { useLocale } from "../lib/locale";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Standalone demo route (/hero-preview).

   The intro is deliberately a one-shot, non-blocking reveal: identity and
   headline are painted on the first frame (opacity animates from 0.001,
   never from a covering black layer), the 3D scene fades in behind them,
   and everything settles by ~2s. There is no loading screen — the earlier
   version stacked a Suspense spinner, a fake "INITIALIZING SYSTEM"
   sequence, and a reveal delay, which read as a site failing to load. */
export function HeroPreview() {
  const { language, t } = useLocale();
  const [introDone, setIntroDone] = useState(false);
  const researchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const scrollToResearch = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    researchRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="hero-preview relative min-h-screen cursor-none" style={{ background: "#05070b", color: "#f3f4f6" }}>
      <CustomCursor />
      <Navigation />

      <section className="relative min-h-screen overflow-hidden">
        {/* 3D sits behind content and fades in after the text is already readable */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
        >
          <WebGLBoundary>
            <HeroScene3D />
          </WebGLBoundary>
        </motion.div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 90% at 50% 100%, transparent 20%, rgba(5,7,11,0.92) 78%)" }}
        />

        <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 pt-28 pb-24 sm:px-10">
          {/* L1 identity — first thing painted, no delay */}
          <motion.p
            className="mb-6 text-xs font-medium uppercase tracking-[0.22em] sm:text-sm"
            initial={{ opacity: 0.001, y: 8 }}
            animate={{ opacity: 0.8, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {lab.shortName} · {language === "en" ? lab.universityEn : lab.university}
          </motion.p>

          {/* L2 main statement */}
          <motion.h1
            className="max-w-4xl text-[clamp(2.75rem,8.5vw,6.5rem)] font-medium uppercase leading-[0.92] tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
            initial={{ opacity: 0.001, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          >
            {t("高效能", "High Performance")}
            <br />
            <span style={{ color: "#c9b8a0" }}>{t("計算", "Computing")}</span>
          </motion.h1>

          {/* L3 supporting statement — short, not a grant abstract */}
          <motion.p
            className="mt-7 max-w-lg text-lg leading-snug opacity-75 sm:text-xl"
            initial={{ opacity: 0.001, y: 12 }}
            animate={{ opacity: 0.75, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
          >
            {t("探索智慧運算背後的系統。", "We explore the systems behind intelligent computing.")}
          </motion.p>

          {/* L4 research keywords — readable, five of them, not background texture */}
          <motion.ul
            className="mt-10 flex flex-wrap gap-x-6 gap-y-3"
            initial={{ opacity: 0.001 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9, ease: EASE }}
          >
            {heroKeywords.map((word, i) => (
              <motion.li
                key={word}
                className="text-base font-medium uppercase tracking-[0.12em] sm:text-lg"
                style={{ color: "#c9b8a0" }}
                initial={{ opacity: 0.001, y: 8 }}
                animate={{ opacity: 0.9, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.08, ease: EASE }}
              >
                {word}
              </motion.li>
            ))}
          </motion.ul>

          {/* L5 primary action */}
          <motion.div
            className="mt-14 flex flex-wrap items-center gap-6"
            initial={{ opacity: 0.001, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.3, ease: EASE }}
          >
            <button
              onClick={scrollToResearch}
              data-cursor-hover
              className="group flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium uppercase tracking-[0.12em] transition-transform hover:scale-[1.03]"
              style={{ background: "#c9b8a0", color: "#05070b" }}
            >
              {t("探索研究", "Explore Research")}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
            <span
              className="text-xs uppercase tracking-[0.15em] opacity-45 transition-opacity"
              style={{ opacity: introDone ? 0.45 : 0 }}
            >
              {t("向下探索 ↓", "Scroll to explore ↓")}
            </span>
          </motion.div>
        </main>
      </section>

      <PhilosophySection />

      {/* research section — the CTA's destination */}
      <section ref={researchRef} className="relative mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] opacity-50">Research Network</p>
        <h2 className="mb-14 max-w-3xl text-[clamp(1.75rem,4vw,3rem)] font-medium uppercase leading-tight tracking-tight">
          {t("研究領域關聯", "Research Connections")}
        </h2>
        <ResearchNetworkGraph />
      </section>

      <ResearchAreas />

      <FeaturedProjects />

      <div className="relative z-10 flex justify-center pb-16">
        <Link
          to="/"
          data-cursor-hover
          className="rounded-full border px-6 py-3 text-xs font-medium uppercase tracking-[0.12em] opacity-70 transition-opacity hover:opacity-100"
          style={{ borderColor: "rgba(255,255,255,0.25)" }}
        >
          {t("← 這是首頁展示預覽，回到正式首頁", "← This is a hero preview. Return to the main site")}
        </Link>
      </div>

      <Footer />
    </div>
  );
}
