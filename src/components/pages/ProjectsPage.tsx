import { motion } from "motion/react";
import { PageShell } from "../layout/PageShell";
import { projects, type Project } from "../../data/projects";
import { useLocale } from "../../lib/locale";

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { language, t } = useLocale();
  return <motion.article className="project-showcase-card" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.06 }}>
    <figure className="project-showcase-image"><img src={project.image} alt={language === "en" ? project.imageAltEn : project.imageAltZh} loading={index ? "lazy" : "eager"} decoding="async" /></figure>
    <div className="project-showcase-copy">
      <p className="project-showcase-number">{String(index + 1).padStart(2, "0")} / {project.group === "research" ? t("研究系統", "Research system") : t("運算平台", "Computing platform")}</p>
      <h3>{language === "en" ? project.titleEn : project.titleZh}</h3>
      {language !== "en" && <p className="project-showcase-english">{project.titleEn}</p>}
      <p className="project-showcase-description">{language === "en" ? project.descriptionEn : project.descriptionZh}</p>
      <ul className="project-showcase-tags">{project.categories.map(category => <li key={category}>{category}</li>)}</ul>
    </div>
  </motion.article>;
}

export function ProjectsPage() {
  const { t } = useLocale();
  const research = projects.filter(project => project.group === "research");
  const platforms = projects.filter(project => project.group === "platform");
  return <PageShell eyebrow="Projects" title={t("研究專案", "Research Projects")} lede={t("從研究應用到支撐它們的運算平台，透過系統畫面認識實驗室的工作。", "Explore our research applications and the computing platforms behind them through system views.")}>
    <div className="project-showcase-wrap">
      <section aria-labelledby="research-systems-title"><div className="project-showcase-section-head"><span>01</span><h2 id="research-systems-title">{t("研究系統", "Research systems")}</h2><p>{t("應用、分析與資料", "Applications, analysis and data")}</p></div><div className="project-showcase-grid">{research.map((project, i) => <ProjectCard key={project.id} project={project} index={i} />)}</div></section>
      <section aria-labelledby="compute-platforms-title"><div className="project-showcase-section-head"><span>02</span><h2 id="compute-platforms-title">{t("運算平台", "Computing platforms")}</h2><p>{t("支撐研究的基礎設施", "Infrastructure supporting research")}</p></div><div className="project-showcase-grid">{platforms.map((project, i) => <ProjectCard key={project.id} project={project} index={research.length + i} />)}</div></section>
      <p className="project-showcase-note">{t("畫面供專案展示，並非即時影像或即時數據。", "Images showcase the projects and do not show live video or data.")}</p>
    </div>
  </PageShell>;
}
