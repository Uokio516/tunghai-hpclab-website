import { useEffect, useMemo, useState } from "react";
import { PageShell, EmptyState } from "../layout/PageShell";
import { publications } from "../../data/publications";
import { professor } from "../../data/lab";
import { useLocale } from "../../lib/locale";
import type { PublicationRecord, PublicationSnapshot } from "../../lib/publicationTypes";

function citationDetail(p: (typeof publications)[number]) {
  const bits: string[] = [];
  if (p.volume) bits.push(`Vol. ${p.volume}`);
  if (p.issue) bits.push(`No. ${p.issue}`);
  if (p.pages) bits.push(`pp. ${p.pages}`);
  if (p.articleNumber) bits.push(`Art. ${p.articleNumber}`);
  return bits.join(" · ");
}

export function PublicationsPage() {
  const { t, language } = useLocale();
  const [snapshot, setSnapshot] = useState<(PublicationSnapshot & { syncDelayed?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [query,setQuery] = useState("");
  const [selectedYear,setSelectedYear] = useState("");
  const [limit,setLimit] = useState(24);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/publications",{signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!Array.isArray(data.publications) || !data.publications.length || !data.publications.every((p: PublicationRecord) => typeof p.id==="string" && typeof p.title==="string" && typeof p.year==="string" && Array.isArray(p.authors))) throw new Error("invalid");
      setSnapshot(data);
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[]);
  const all: PublicationRecord[] = snapshot?.publications ?? publications;
  const availableYears = [...new Set(all.map(p=>p.year))].sort((a,b)=>Number(b)-Number(a));
  const filtered = useMemo(() => all.filter(p => (!selectedYear || p.year===selectedYear) && [p.title,...p.authors,p.venue,p.doi ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[all,selectedYear,query]);
  const visible = filtered.slice(0,limit);
  const byYear = visible.reduce<Record<string, PublicationRecord[]>>((acc, p) => {
    (acc[p.year] ||= []).push(p);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <PageShell
      eyebrow="Publications"
      title={t("論文著作", "Publications")}
      lede={t("探索實驗室的研究著作，依年份、題目或作者尋找論文。清單每週自動更新。", "Explore the lab's publications by year, title or author. The bibliography updates weekly.")}
    >
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        <div className="publication-toolbar">
          <label>{t("搜尋論文", "Search publications")}<input type="search" value={query} placeholder={t("題目、作者、期刊或 DOI", "Title, author, venue or DOI")} onChange={event=>{setQuery(event.target.value);setLimit(24);}} /></label>
          <label>{t("年份", "Year")}<select value={selectedYear} onChange={event=>{setSelectedYear(event.target.value);setLimit(24);}}><option value="">{t("全部年份", "All years")}</option>{availableYears.map(year=><option key={year}>{year}</option>)}</select></label>
        </div>
        <div className="publication-summary" aria-live="polite">
          <span>{loading ? t("讀取最新清單…", "Loading bibliography…") : t(`共 ${all.length} 篇 · 找到 ${filtered.length} 篇`, `${all.length} publications · ${filtered.length} results`)}</span>
          {snapshot?.updatedAt && <span>{t("最近更新：", "Updated: ")}{new Date(snapshot.updatedAt).toLocaleDateString(language==="en" ? "en-US" : "zh-TW",{timeZone:"Asia/Taipei"})}</span>}
        </div>
        {(!loading && !snapshot || snapshot?.syncDelayed) && <p className="publication-cache-note">{t("目前顯示已保存的清單，來源恢復後會繼續更新。", "Showing saved publications. Updates resume when the source becomes available.")}</p>}
        <p className="publication-source-links"><a href={professor.scholarUrl!} target="_blank" rel="noreferrer noopener">Google Scholar ↗</a><a href={professor.dblpUrl} target="_blank" rel="noreferrer noopener">DBLP ↗</a></p>
        {filtered.length === 0 ? (
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
                <ul className="publication-grid">
                  {byYear[year].map((p) => (
                    <li key={p.id} className="publication-card">
                      <h3 className="max-w-4xl text-base font-medium leading-snug sm:text-lg">{p.title}</h3>
                      <p className="mt-1.5 text-sm opacity-75">
                        <span style={{ color: "var(--brand-light)" }}>{p.venue}</span>
                        {citationDetail(p) && <span className="opacity-70"> · {citationDetail(p)}</span>}
                      </p>
                      <details><summary>{t("作者與出版資訊", "Authors and publication details")}</summary><p>{p.authors.join(", ")}</p>{p.doi && <p>DOI: {p.doi}</p>}{p.crossrefVerified && <small>{t("出版資料經 Crossref 核對", "Metadata verified with Crossref")}</small>}</details>
                      {p.url && <a className="publication-open" href={p.url} target="_blank" rel="noreferrer noopener">{t("查看論文 ↗", "View publication ↗")}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {visible.length<filtered.length && <button type="button" className="member-primary publication-more" onClick={()=>setLimit(value=>value+24)}>{t("載入更多論文", "Load more publications")}</button>}
            <p className="publication-coverage">{t("合併公開文獻索引與既有精選著作；各資料庫的收錄範圍可能不同。", "Combines public bibliographic indexes and curated publications. Coverage varies between databases.")}</p>
          </>
        )}
      </section>
    </PageShell>
  );
}
