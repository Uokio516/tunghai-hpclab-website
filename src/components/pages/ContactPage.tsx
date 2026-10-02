import { PageShell } from "../layout/PageShell";
import { lab, professor } from "../../data/lab";
import { Link } from "react-router-dom";

export function ContactPage() {
  return (
    <PageShell eyebrow="Contact" title="聯絡我們" lede="歡迎討論研究合作、運算資源與加入實驗室的機會。">
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        <div
          className="grid gap-10 border-t pt-10 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">Laboratory</p>
            <p className="text-base">{lab.nameZh}</p>
            <p className="mt-1 text-sm opacity-65">{lab.nameEn}</p>
            <p className="mt-3 text-sm opacity-55">成立於 {lab.founded} 年</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">Institution</p>
            <p className="text-base">{lab.university}</p>
            <p className="mt-1 text-sm opacity-65">{lab.department}</p>
            <p className="mt-1 text-sm opacity-55">{lab.universityEn}</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] opacity-45">
              Principal Investigator
            </p>
            <p className="text-base">
              {professor.nameZh} · {professor.title}
            </p>
            <p className="mt-1 text-sm opacity-65">{professor.nameEn}</p>
          </div>
        </div>

        <div className="mt-14">
          <Link to="/#contact" className="mr-4 mb-4 inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium transition-transform hover:scale-[1.03]" style={{ background: "var(--brand-light)", color: "var(--brand-contrast)" }}>傳送留言 ↗</Link>
          <a
            href={lab.website}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium uppercase tracking-[0.12em] transition-transform hover:scale-[1.03]"
            style={{ background: "var(--brand-light)", color: "var(--brand-contrast)" }}
          >
            研究室官方網站 ↗
          </a>
        </div>
      </section>
    </PageShell>
  );
}
