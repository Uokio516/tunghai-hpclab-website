import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Cpu, Server, Activity, Zap, AlertTriangle } from "lucide-react";
import { MetricArc, MonitoringChrome } from "./MonitoringChrome";

type Gpu = {
  index: string; name: string; model: string; driver: string;
  util: number | null; utilPeak1h?: number | null; memUsed: number | null; memTotal: number | null;
  temp: number | null; power: number | null; powerLimit: number | null; fan: number | null;
};
type Machine = {
  id: string; label: string; location: string;
  online: boolean; cpuPercent: number | null; ramUsed: number | null; ramTotal: number | null;
  telemetryStatus?: "healthy" | "collector-error" | "awaiting-data";
  telemetryCode?: number | null;
  gpus: Gpu[];
};
type Data = {
  updatedAt: string; source: string;
  summary: { machinesTotal: number; machinesOnline: number; gpusOnline: number; gpusBusy: number };
  machines: Machine[];
};

const REFRESH_MS = 12_000;
const GB = 1024 ** 3;

// load → colour (idle→busy). A separate, more saturated scale from the
// brand accent — this is functional data-viz, not identity.
function loadColor(r: number | null) {
  if (r == null) return "var(--text-faint)";
  if (r < 0.2) return "var(--good)";
  if (r < 0.7) return "var(--warn)";
  return "var(--critical)";
}
function tempColor(t: number | null) {
  if (t == null) return "var(--text-faint)";
  if (t < 60) return "var(--good)";
  if (t < 80) return "var(--warn)";
  return "var(--critical)";
}

function formatPercent(value: number) {
  if (value > 0 && value < 0.1) return "<0.1%";
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function GpuFleet() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [at, setAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "idle" | "issues">("all");
  const visible = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!visible.current) return;
      try {
        const r = await fetch("/api/gpus", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Data;
        if (!alive) return;
        setData(j); setError(false); setAt(new Date());
      } catch { if (alive) setError(true); }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    const onVisibility = () => {
      visible.current = document.visibilityState === "visible";
      if (visible.current) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const visibleMachines = data?.machines.filter((machine) => {
    if (filter === "issues") return !machine.online || machine.telemetryStatus === "collector-error";
    if (filter === "active") return machine.gpus.some((gpu) => (gpu.util ?? 0) >= 0.2);
    if (filter === "idle") return machine.online && machine.gpus.length > 0 && machine.gpus.every((gpu) => (gpu.util ?? 0) < 0.2);
    return true;
  }) ?? [];

  return (
    <MonitoringChrome
      eyebrow="Library GPU Fleet · Prometheus"
      title={<>GPU <span style={{ color: "var(--brand-light)" }}>機房遙測</span></>}
      description="從 GPU 核心負載、顯存、溫度與功耗，到主機 CPU、RAM，將分散的運算節點收斂成一個即時控制平面。"
      live
      meta={<><div><RefreshCw className="mr-2 inline h-3 w-3" />12 秒輪詢</div><div>{at ? `Last sync ${at.toLocaleTimeString("zh-TW", { hour12: false })}` : "Connecting…"}</div><div>Prometheus · Exporters</div></>}
    >
        {error && !data && <div className="panel p-8 text-center text-base" style={{ color: "var(--critical)" }}>監控資料暫時無法讀取。</div>}
        {!error && !data && <div className="panel animate-pulse p-8 text-center text-base" style={{ color: "var(--text-dim)" }}>載入中…</div>}

        {data && (
          <>
            <div className="monitor-kpi-grid">
              <Kpi icon={Server} label="機器在線" value={`${data.summary.machinesOnline}/${data.summary.machinesTotal}`} />
              <Kpi icon={Cpu} label="GPU 在線" value={String(data.summary.gpusOnline)} />
              <Kpi icon={Activity} label="使用中 GPU" value={String(data.summary.gpusBusy)} />
              <Kpi icon={Zap} label="閒置 GPU" value={String(Math.max(0, data.summary.gpusOnline - data.summary.gpusBusy))} />
            </div>

            <div className="metric-arcs">
              <MetricArc value={data.summary.machinesOnline} max={data.summary.machinesTotal} label="Host availability" display={`${Math.round(data.summary.machinesOnline / Math.max(1, data.summary.machinesTotal) * 100)}%`} color="var(--good)" />
              <MetricArc value={data.summary.gpusBusy} max={data.summary.gpusOnline} label="Fleet load" display={`${Math.round(data.summary.gpusBusy / Math.max(1, data.summary.gpusOnline) * 100)}%`} color="var(--warn)" />
              <MetricArc value={data.machines.filter((m) => m.telemetryStatus === "collector-error").length} max={data.summary.machinesTotal} label="Telemetry issues" display={String(data.machines.filter((m) => m.telemetryStatus === "collector-error").length)} color="var(--critical)" />
            </div>

            <div className="monitor-toolbar">
              <div>
                <p className="monitor-eyebrow">Compute nodes</p>
                <h2 className="mt-1 text-2xl font-medium not-italic">工作站狀態</h2>
              </div>
              <div className="monitor-filters">
                {([
                  ["all", "全部"],
                  ["active", "運算中"],
                  ["idle", "閒置"],
                  ["issues", "需注意"],
                ] as const).map(([id, label]) => (
                  <button key={id} className="monitor-filter" data-active={filter === id} onClick={() => setFilter(id)}>
                    {id === "issues" && <AlertTriangle className="mr-1 inline h-3 w-3" />}{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="machine-grid">
              {visibleMachines.map((m, i) => <MachineCard key={m.id} m={m} delay={i * 0.03} />)}
            </div>

            <p className="mt-9 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              資料來源 Prometheus · nvidia_gpu_exporter · node_exporter
            </p>
          </>
        )}
    </MonitoringChrome>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="monitor-kpi">
      <Icon className="mb-1 h-5 w-5" style={{ color: "var(--brand)" }} />
      <div className="monitor-kpi-label">{label}</div>
      <div className="monitor-kpi-value">{value}</div>
    </div>
  );
}

function MachineCard({ m, delay }: { m: Machine; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      className="machine-card-new"
      style={{ opacity: m.online ? 1 : 0.6 }}
    >
      <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-lg font-bold">{m.label}</span>
            {m.gpus[0] && (
              <span className="rounded px-2 py-0.5 text-xs font-bold tabular-nums" style={{ color: "var(--good)", background: "var(--good-soft)", fontFamily: "var(--font-mono)" }}>
                {m.gpus[0].model}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm" style={{ color: "var(--text-faint)" }}>{m.location || ""}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold" style={{ color: m.online ? "var(--good)" : "var(--text-faint)" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: m.online ? "var(--good)" : "var(--text-faint)" }} />
          {m.online ? "在線" : "離線"}
        </span>
      </div>

      {m.online && (m.cpuPercent != null || m.ramTotal != null) && (
        <div className="grid grid-cols-2 gap-5 p-5" style={{ borderBottom: "1px solid var(--border)" }}>
          {m.cpuPercent != null && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span style={{ color: "var(--text-dim)" }}>CPU</span>
                <span className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{formatPercent(m.cpuPercent)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${m.cpuPercent}%`, background: loadColor(m.cpuPercent / 100) }} />
              </div>
            </div>
          )}
          {m.ramTotal != null && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span style={{ color: "var(--text-dim)" }}>記憶體</span>
                <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                  {m.ramUsed != null ? `${(m.ramUsed / GB).toFixed(0)} / ${(m.ramTotal / GB).toFixed(0)} GB` : "—"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ background: "var(--brand)", width: `${m.ramUsed != null ? (m.ramUsed / m.ramTotal) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {m.online && m.gpus.length > 0 ? (
        <div>
          {m.gpus.map((g, i) => <GpuRow key={g.index} g={g} last={i === m.gpus.length - 1} />)}
        </div>
      ) : (
        <div className="p-5">
          {m.online ? (
            <>
              <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--warn)" }}>
                <Activity className="h-4 w-4" />
                GPU 遙測異常
              </div>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-faint)" }}>
                Exporter 在線，但 NVIDIA 遙測暫時收集失敗
                {m.telemetryCode != null ? `（診斷代碼 ${m.telemetryCode}）` : ""}。系統會持續自動重試。
              </p>
            </>
          ) : (
            <p className="text-base" style={{ color: "var(--text-faint)" }}>工作站目前離線，等待恢復連線。</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function GpuRow({ g, last }: { g: Gpu; last: boolean }) {
  const util = g.util ?? 0;
  const memPct = g.memUsed != null && g.memTotal ? g.memUsed / g.memTotal : 0;
  return (
    <div className="p-5" style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}>
      <div className="mb-2.5 flex items-center justify-between text-sm">
        <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>GPU {g.index}</span>
        <div className="flex items-center gap-3.5 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
          <span style={{ color: tempColor(g.temp) }}>{g.temp != null ? `${g.temp}°C` : "—"}</span>
          <span style={{ color: "var(--text-dim)" }}>{g.power != null ? `${Math.round(g.power)}W` : "—"}</span>
          {g.fan != null && <span style={{ color: "var(--text-faint)" }}>風扇 {Math.round(g.fan * 100)}%</span>}
        </div>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span style={{ color: "var(--text-dim)" }}>
          使用率 <small style={{ color: "var(--text-faint)" }}>1 分鐘平均</small>
        </span>
        <span className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
          {formatPercent(util * 100)}
          {g.utilPeak1h != null && (
            <small className="ml-2 font-normal" style={{ color: "var(--text-faint)" }}>
              1h 峰值 {formatPercent(g.utilPeak1h * 100)}
            </small>
          )}
        </span>
      </div>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${util * 100}%`, background: loadColor(util) }} />
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span style={{ color: "var(--text-dim)" }}>記憶體</span>
        <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
          {g.memUsed != null && g.memTotal ? `${(g.memUsed / GB).toFixed(1)} / ${(g.memTotal / GB).toFixed(0)} GB` : "—"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${memPct * 100}%`, background: "var(--brand)" }} />
      </div>
    </div>
  );
}
