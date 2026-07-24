import { PageShell, EmptyState } from "../layout/PageShell";
import { news } from "../../data/news";

export function NewsPage() {
  return (
    <PageShell eyebrow="News" title="最新消息">
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {news.length === 0 ? (
          <EmptyState message="目前尚無公開消息。" />
        ) : (
          <ul className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            {news.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 border-b py-8 sm:flex-row sm:gap-12"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                <p className="font-mono text-sm tabular-nums opacity-50 sm:w-32">{item.date}</p>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-[0.15em]" style={{ color: "#c9b8a0" }}>
                    {item.category}
                  </p>
                  <p className="text-base sm:text-lg">{item.titleZh}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
