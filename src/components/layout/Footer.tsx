import { lab } from "../../data/lab";
import { Link } from "react-router-dom";
import { navItems } from "../../lib/constants";

export function Footer() {
  return (
    <footer className="site-footer relative z-10 px-5 py-10 sm:px-8" style={{ background: "var(--bg)", color: "var(--text)", borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-7 md:flex-row">
          <div><Link to="/" className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>HPC Lab</Link><p className="mt-2 text-sm opacity-60">{lab.university} · {lab.department} · {lab.nameZh}</p></div>
          <nav aria-label="頁尾導覽" className="flex max-w-xl flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            {navItems.filter(item => item.to !== "/").map(item => <Link key={item.to} to={item.to} className="opacity-65 transition-opacity hover:opacity-100">{item.labelZh}</Link>)}
          </nav>
        </div>
        <div className="mt-7 flex flex-col justify-between gap-3 border-t pt-5 text-xs opacity-50 sm:flex-row" style={{ borderColor: "var(--border)" }}>
          <p>© {new Date().getFullYear()} {lab.nameEn}</p>
          <a href="https://hpc.thu.edu.tw/profile/" target="_blank" rel="noopener noreferrer">指導教授 ↗</a>
        </div>
      </div>
    </footer>
  );
}
