import { motion } from "motion/react";
import { PageShell, EmptyState } from "../layout/PageShell";
import { projects } from "../../data/projects";

export function ProjectsPage() {
  return (
    <PageShell
      eyebrow="Projects"
      title="研究專案"
      lede="以下為公開資料可查證的代表性研究成果。"
    >
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {projects.length === 0 ? (
          <EmptyState message="專案資料整理中。" />
        ) : (
          <ul className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            {projects.map((project, i) => (
              <motion.li
                key={project.id}
                className="border-b py-10"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: Math.min(i, 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:gap-16">
                  <div className="lg:w-2/5">
                    <p className="mb-3 font-mono text-xs tabular-nums opacity-45">{project.year}</p>
                    <h2 className="text-[clamp(1.35rem,3vw,2.25rem)] font-medium uppercase leading-tight tracking-tight">
                      {project.titleEn}
                    </h2>
                    <p className="mt-2 text-sm opacity-60 sm:text-base">{project.titleZh}</p>
                  </div>
                  <div className="lg:w-3/5">
                    <p className="text-base leading-relaxed opacity-80">{project.descriptionZh}</p>
                    {project.note && (
                      <p className="mt-3 text-sm leading-relaxed opacity-55">{project.note}</p>
                    )}
                    <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                      {project.categories.map((c) => (
                        <li
                          key={c}
                          className="text-xs font-medium uppercase tracking-[0.1em]"
                          style={{ color: "#c9b8a0" }}
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
