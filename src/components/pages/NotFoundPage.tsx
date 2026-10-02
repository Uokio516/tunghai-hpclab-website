import { Link } from "react-router-dom";
import { PageShell } from "../layout/PageShell";

export function NotFoundPage() {
  return (
    <PageShell eyebrow="404" title="找不到這個頁面" lede="這個網址不存在,或是內容已經移動了。">
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        <Link
          to="/"
          data-cursor-hover
          className="inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-medium uppercase tracking-[0.12em] transition-transform hover:scale-[1.03]"
          style={{ background: "var(--brand-light)", color: "var(--brand-contrast)" }}
        >
          回到首頁
        </Link>
      </section>
    </PageShell>
  );
}
