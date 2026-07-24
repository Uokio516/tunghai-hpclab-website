import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu as MenuIcon, X } from "lucide-react";
import { MenuOverlay } from "./MenuOverlay";
import { navItems } from "../../lib/constants";

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className="nav-surface fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-6 px-5 py-4 sm:px-8"
      >
        <Link
          to="/"
          data-cursor-hover
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: "#f3f4f6", outlineColor: "#c9b8a0" }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2" style={{ borderColor: "#a78b71" }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#c9b8a0" }} />
          </span>
          <span className="flex flex-col leading-none">
            <strong className="text-xl italic" style={{ fontFamily: "var(--font-serif)" }}>HPC Lab</strong>
            <small className="nav-university mt-1 text-[10px] uppercase tracking-[0.15em] opacity-50">Tunghai University</small>
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 xl:flex" aria-label="主要導覽">
          {navItems
            .filter((item) => ["HOME", "RESEARCH", "PROJECTS", "PEOPLE", "PUBLICATIONS", "GPU MONITOR", "CLUSTERS"].includes(item.labelEn))
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-white/10"
                style={{ color: "#f3f4f6" }}
              >
                {item.labelEn}
              </Link>
            ))}
        </nav>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "關閉選單" : "開啟選單"}
          data-cursor-hover
          className="site-menu-button flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-medium uppercase tracking-[0.15em] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: "#f3f4f6", borderColor: "rgba(255,255,255,0.28)", outlineColor: "#c9b8a0" }}
        >
          {open ? <X size={18} /> : <MenuIcon size={18} />}
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </header>
      <MenuOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
