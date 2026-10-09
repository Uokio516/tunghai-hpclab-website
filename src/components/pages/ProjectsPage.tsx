import { motion } from "motion/react";
import { PageShell, EmptyState } from "../layout/PageShell";
import { projects } from "../../data/projects";
import { useLocale } from "../../lib/locale";

export function ProjectsPage() {
  const { language, t } = useLocale();
  return (
    <PageShell
      eyebrow="Projects"
      title={t("研究專案", "Research Projects")}
      lede={t("以下為公開資料可查證的代表性研究成果。", "Selected research projects verified through public sources.")}
    >
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {projects.length === 0 ? (
          <EmptyState message={t("專案資料整理中。", "Project information is being prepared.")} />
        ) : (
          <ul className="border-t" style={{ borderColor: "var(--border)" }}>
            {projects.map((project, i) => (
              <motion.li
                key={project.id}
                className="border-b py-10"
                style={{ borderColor: "var(--border)" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: Math.min(i, 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:gap-16">
                  <div className="lg:w-2/5">
                    <p className="mb-3 font-mono text-xs tabular-nums opacity-45">{project.year}</p>
                    <h2 className="text-[clamp(1.35rem,3vw,2.25rem)] font-medium uppercase leading-tight tracking-tight">
                      {language === "en" ? project.titleEn : project.titleZh}
                    </h2>
                    {language !== "en" && <p className="mt-2 text-sm opacity-60 sm:text-base">{project.titleEn}</p>}
                  </div>
                  <div className="lg:w-3/5">
                    <p className="text-base leading-relaxed opacity-80">{language === "en" ? project.descriptionEn : project.descriptionZh}</p>
                    {project.note && (
                      <p className="mt-3 text-sm leading-relaxed opacity-55">{language === "en" ? project.noteEn ?? project.note : project.note}</p>
                    )}
                    <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                      {project.categories.map((c) => (
                        <li
                          key={c}
                          className="text-xs font-medium uppercase tracking-[0.1em]"
                          style={{ color: "var(--brand-light)" }}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
