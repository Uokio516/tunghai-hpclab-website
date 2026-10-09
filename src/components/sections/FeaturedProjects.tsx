import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { projects } from "../../data/projects";
import { useLocale } from "../../lib/locale";

const FEATURED = projects.filter((p) => p.featured).slice(0, 3);

/* Homepage-scale teaser (3 of the 5 real projects) — full list with real
   descriptions/notes lives at /projects. Same numbered-row language as
   ResearchAreas rather than a card grid, so the page reads as one system. */
export function FeaturedProjects() {
  const { language, t } = useLocale();
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
      <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] opacity-50">Projects</p>
          <h2 className="max-w-2xl text-[clamp(1.75rem,4vw,3rem)] font-medium uppercase leading-tight tracking-tight">
            {t("代表性研究專案", "Featured Research Projects")}
          </h2>
        </div>
        <Link
          to="/projects"
          data-cursor-hover
          className="group flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] opacity-70 transition-opacity hover:opacity-100"
          style={{ color: "#c9b8a0" }}
        >
          {t("查看全部專案", "View all projects")}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <ul className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        {FEATURED.map((project, i) => (
          <motion.li
            key={project.id}
            className="border-b py-8"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:gap-8">
              <span className="font-mono text-xs tabular-nums opacity-45 sm:w-14">{project.year}</span>
              <div className="flex-1">
                <h3 className="text-xl font-medium uppercase leading-tight tracking-tight sm:text-2xl">
                  {language === "en" ? project.titleEn : project.titleZh}
                </h3>
                {language !== "en" && <p className="mt-1 text-sm opacity-60">{project.titleEn}</p>}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 sm:w-48 sm:justify-end">
                {project.categories.slice(0, 2).map((c) => (
                  <li key={c} className="text-xs font-medium uppercase tracking-[0.08em]" style={{ color: "#c9b8a0" }}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
