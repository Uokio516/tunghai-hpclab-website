import { PageShell, EmptyState } from "../layout/PageShell";
import { publications } from "../../data/publications";
import { professor } from "../../data/lab";
import { useLocale } from "../../lib/locale";

function citationDetail(p: (typeof publications)[number]) {
  const bits: string[] = [];
  if (p.volume) bits.push(`Vol. ${p.volume}`);
  if (p.issue) bits.push(`No. ${p.issue}`);
  if (p.pages) bits.push(`pp. ${p.pages}`);
  if (p.articleNumber) bits.push(`Art. ${p.articleNumber}`);
  return bits.join(" · ");
}

export function PublicationsPage() {
  const { t } = useLocale();
  const byYear = publications.reduce<Record<string, typeof publications>>((acc, p) => {
    (acc[p.year] ||= []).push(p);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <PageShell
      eyebrow="Publications"
      title={t("論文著作", "Publications")}
      lede={t("以下為公開資料庫可查證的代表性論文,並非完整著作列表。完整清單請參考 DBLP。", "Selected publications verified through public databases. See DBLP for the complete list.")}
    >
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {publications.length === 0 ? (
          <EmptyState message={t("論文資料整理中。", "Publication information is being prepared.")} />
        ) : (
          <>
            {years.map((year) => (
              <div key={year} className="mb-16">
                <h2
                  className="mb-6 border-b pb-3 font-mono text-2xl tabular-nums sm:text-3xl"
                  style={{ borderColor: "var(--border)", color: "var(--brand-light)" }}
                >
                  {year}
                </h2>
                <ul className="space-y-8">
                  {byYear[year].map((p) => (
                    <li key={p.id}>
                      <h3 className="max-w-4xl text-base font-medium leading-snug sm:text-lg">{p.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-60">
                        {p.authors.join(", ")}
                      </p>
                      <p className="mt-1.5 text-sm opacity-75">
                        <span style={{ color: "var(--brand-light)" }}>{p.venue}</span>
                        {citationDetail(p) && <span className="opacity-70"> · {citationDetail(p)}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-sm opacity-60">
              {t("完整著作列表：", "Complete publication list:")}
              <a
                href={professor.dblpUrl}
                target="_blank"
                rel="noreferrer noopener"
                data-cursor-hover
                className="ml-2 underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: "var(--brand-light)" }}
              >
                DBLP
              </a>
            </p>
          </>
        )}
      </section>
    </PageShell>
  );
}
