import { PageShell } from "../layout/PageShell";
import { lab, professor } from "../../data/lab";
import { Link } from "react-router-dom";
import { useLocale } from "../../lib/locale";

export function ContactPage() {
  const { language, t } = useLocale();
  return (
    <PageShell eyebrow="Contact" title={t("聯絡我們", "Contact Us")} lede={t("歡迎討論研究合作、運算資源與加入實驗室的機會。", "Get in touch about research collaborations, computing resources, or joining the lab.")}>
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        <div
          className="grid gap-10 border-t pt-10 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">Laboratory</p>
            <p className="text-base">{language === "en" ? lab.nameEn : lab.nameZh}</p>
            {language !== "en" && <p className="mt-1 text-sm opacity-65">{lab.nameEn}</p>}
            <p className="mt-3 text-sm opacity-55">{t(`成立於 ${lab.founded} 年`, `Founded in ${lab.founded}`)}</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">Institution</p>
            <p className="text-base">{language === "en" ? lab.universityEn : lab.university}</p>
            <p className="mt-1 text-sm opacity-65">{language === "en" ? lab.departmentEn : lab.department}</p>
            {language !== "en" && <p className="mt-1 text-sm opacity-55">{lab.universityEn}</p>}
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">
              Principal Investigator
            </p>
            <p className="text-base">
              {language === "en" ? `${professor.nameEn} · ${professor.titleEn}` : `${professor.nameZh} · ${professor.title}`}
            </p>
            {language !== "en" && <p className="mt-1 text-sm opacity-65">{professor.nameEn}</p>}
          </div>
        </div>

        <div className="mt-14">
          <Link to="/#contact" className="mr-4 mb-4 inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium transition-transform hover:scale-[1.03]" style={{ background: "var(--brand-light)", color: "var(--brand-contrast)" }}>{t("傳送留言 ↗", "Send a Message ↗")}</Link>
          <a
            href={lab.website}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium uppercase tracking-[0.12em] transition-transform hover:scale-[1.03]"
            style={{ background: "var(--brand-light)", color: "var(--brand-contrast)" }}
          >
            {t("研究室官方網站 ↗", "Official Lab Website ↗")}
          </a>
        </div>
      </section>
    </PageShell>
  );
}
