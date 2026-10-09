import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu as MenuIcon, X, Sun, Moon } from "lucide-react";
import { MenuOverlay } from "./MenuOverlay";
import { navItems } from "../../lib/constants";
import { useLocale } from "../../lib/locale";

export function Navigation() {
  const { language, setLanguage, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("hpclab-theme");
    const isLight = saved === "light";
    setLight(isLight);
    document.documentElement.dataset.theme = isLight ? "light" : "dark";
  }, []);
  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    localStorage.setItem("hpclab-theme", next ? "light" : "dark");
  };

  return (
    <>
      <header
        className="site-navigation fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-5 sm:px-8"
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
        <nav className="ml-auto hidden items-center gap-1 xl:flex" aria-label={t("主要導覽", "Main navigation")}>
          {navItems
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `site-nav-link rounded-full px-3 py-2 text-sm font-medium transition-colors ${isActive ? "is-active" : ""}`}
                style={{ color: "#f3f4f6" }}
              >
                {language === "en" ? item.labelEn : item.labelZh}
              </NavLink>
            ))}
        </nav>
        <button type="button" className="site-language-button" onClick={() => setLanguage(language === "en" ? "zh-TW" : "en")} aria-label={t("切換為英文", "Switch to Traditional Chinese")} title={t("切換為英文", "Switch to Traditional Chinese")}>{language === "en" ? "中文" : "EN"}</button>
        <button className="site-theme-button" onClick={toggleTheme} aria-label={t("切換明暗主題", "Toggle color theme")}>{light ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("關閉選單", "Close menu") : t("開啟選單", "Open menu")}
          data-cursor-hover
          className="site-menu-button flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-medium uppercase tracking-[0.15em] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: "#f3f4f6", borderColor: "rgba(255,255,255,0.28)", outlineColor: "#c9b8a0" }}
        >
          {open ? <X size={18} /> : <MenuIcon size={18} />}
          <span>{open ? t("關閉", "Close") : t("選單", "Menu")}</span>
        </button>
      </header>
      <MenuOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
