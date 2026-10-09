import { Radio } from "lucide-react";
import { Navigation } from "./layout/Navigation";
import { Footer } from "./layout/Footer";
import { useLocale } from "../lib/locale";

export function MonitoringChrome({
  eyebrow,
  title,
  description,
  live,
  meta,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  live: boolean;
  meta: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="monitor-page relative min-h-screen overflow-x-hidden">
      <div className="monitor-grid" aria-hidden="true" />
      <div className="monitor-glow monitor-glow-a" aria-hidden="true" />
      <div className="monitor-glow monitor-glow-b" aria-hidden="true" />
      <Navigation />
      <main className="monitor-main relative z-10 mx-auto max-w-[1480px] px-5 pb-24 sm:px-8">
        <header className="monitor-hero">
          <div>
            <p className="monitor-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="monitor-description">{description}</p>
          </div>
          <div className="monitor-meta">
            <div style={{ color: live ? "var(--good)" : "var(--warn)" }}>
              <Radio className="mr-2 inline h-3.5 w-3.5" />{live ? t("即時遙測", "Live telemetry") : t("非即時資料", "Historical data")}
            </div>
            {meta}
          </div>
        </header>
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function MetricArc({ value, max, label, display, color = "var(--brand-light)" }: {
  value: number; max: number; label: string; display: string; color?: string;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="metric-arc" style={{ "--arc-pct": `${pct * 360}deg`, "--arc-color": color } as React.CSSProperties}>
      <div className="metric-arc-ring"><span>{display}</span></div>
      <small>{label}</small>
    </div>
  );
}
