import { PageShell, EmptyState } from "../layout/PageShell";
import { news } from "../../data/news";
import { useLocale } from "../../lib/locale";

export function NewsPage() {
  const { language, t } = useLocale();
  return (
    <PageShell eyebrow="News" title={t("最新消息", "News")}>
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {news.length === 0 ? (
          <EmptyState message={t("目前尚無公開消息。", "There are no public announcements yet.")} />
        ) : (
          <ul className="border-t" style={{ borderColor: "var(--border)" }}>
            {news.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 border-b py-8 sm:flex-row sm:gap-12"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="font-mono text-sm tabular-nums opacity-50 sm:w-32">{item.date}</p>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-[0.15em]" style={{ color: "var(--brand-light)" }}>
                    {item.category}
                  </p>
                  <p className="text-base sm:text-lg">{language === "en" ? item.titleEn ?? item.titleZh : item.titleZh}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
