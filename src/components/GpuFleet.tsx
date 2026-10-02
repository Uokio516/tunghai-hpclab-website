import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Cpu, Server, Activity, HardDrive, AlertTriangle, MemoryStick } from "lucide-react";
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
type InventoryGpu = { model: string; vramGB: number | null; class: string; passthrough: boolean };
type InventoryMachine = {
  id: string; label: string; owner: string; type: string; os: string | null;
  location: string; group: string; groupName: string;
  cpu: string | null; cpuThreads: number | null; ramGB: number | null;
  gpus: InventoryGpu[]; virtual: boolean; countsForCapacity: boolean; edge: boolean;
  online: boolean | null; checkedAt: string | null; lastSeen: string | null; latencyMs: number | null;
};
type Data = {
  updatedAt: string; source: string;
  summary: {
    machinesTotal: number; machinesOnline: number; gpusOnline: number; gpusBusy: number;
    machinesTracked?: number; gpusTotal?: number; vramTotalGB?: number;
    cpuThreadsTotal?: number; ramTotalGB?: number; edgeDevices?: number;
    hostsUp?: number; hostsTotal?: number; probedAt?: string | null;
  };
  gpuModels?: { model: string; count: number; vramGB: number | null }[];
  machines: Machine[];
  inventory?: { updatedAt: string; probedAt: string; machines: InventoryMachine[] } | null;
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

  // Group the un-instrumented machines by room so the page reads as a floor plan
  // rather than one long undifferentiated list.
  const inventoryGroups = (() => {
    const order = ["圖書館機房", "ST430 機房", "叢集實體節點", "ST312 研究室", "ST429 研究室", "辦公室"];
    const by = new Map<string, InventoryMachine[]>();
    const matches = (m: InventoryMachine) => {
      if (filter === "issues") return m.online === false;
      if (filter === "active") return false; // no GPU utilisation telemetry for this tier
      if (filter === "idle") return m.online === true;
      return true;
    };
    (data?.inventory?.machines ?? []).filter(matches).forEach((m) => {
      const k = m.groupName || "其他";
      by.set(k, [...(by.get(k) ?? []), m]);
    });
    return [...by.entries()].sort(
      (a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)
    );
  })();

  return (
    <MonitoringChrome
      eyebrow="Lab Compute Fleet · Prometheus + Inventory"
      title={<>實驗室<span style={{ color: "var(--brand-light)" }}>全部算力</span></>}
      description="實驗室全部算力：有接遙測的機器顯示即時 GPU 負載、顯存、溫度與功耗；其餘已盤點的機器列出規格。搬移中而連不上的機器不列入。"
      live
      meta={<><div><RefreshCw className="mr-2 inline h-3 w-3" />12 秒輪詢</div><div>{at ? `Last sync ${at.toLocaleTimeString("zh-TW", { hour12: false })}` : "Connecting…"}</div><div>Prometheus · Exporters</div></>}
    >
        {error && !data && <div className="panel p-8 text-center text-base" style={{ color: "var(--critical)" }}>監控資料暫時無法讀取。</div>}
        {!error && !data && <div className="panel animate-pulse p-8 text-center text-base" style={{ color: "var(--text-dim)" }}>載入中…</div>}

        {data && (
          <>
            <div className="monitor-kpi-grid">
              <Kpi icon={Cpu} label="GPU 總數" value={String(data.summary.gpusTotal ?? data.summary.gpusOnline)} sub={data.summary.vramTotalGB ? `${data.summary.vramTotalGB} GB 顯存` : undefined} />
              <Kpi icon={Server} label="運算機器" value={String(data.summary.machinesTracked ?? data.summary.machinesTotal)} sub={data.summary.edgeDevices ? `另有 ${data.summary.edgeDevices} 台邊緣裝置` : undefined} />
              <Kpi icon={HardDrive} label="CPU 執行緒" value={String(data.summary.cpuThreadsTotal ?? 0)} sub={data.summary.ramTotalGB ? `${(data.summary.ramTotalGB / 1024).toFixed(1)} TB 記憶體` : undefined} />
              <Kpi
                icon={Activity}
                label="機器在線"
                value={data.summary.hostsTotal != null ? `${data.summary.hostsUp}/${data.summary.hostsTotal}` : `${data.summary.machinesOnline}/${data.summary.machinesTotal}`}
                sub={`深度遙測 ${data.summary.machinesOnline}/${data.summary.machinesTotal} · 使用中 GPU ${data.summary.gpusBusy}`}
              />
            </div>

            {data.gpuModels && data.gpuModels.length > 0 && (
              <div className="gpu-model-strip">
                {data.gpuModels.map((g) => (
                  <span key={g.model} className="gpu-model-chip">
                    <strong>{g.model}</strong>
                    <span>×{g.count}</span>
                    {g.vramGB ? <small>{g.vramGB} GB</small> : null}
                  </span>
                ))}
              </div>
            )}

            <div className="metric-arcs">
              <MetricArc
                value={data.summary.hostsUp ?? data.summary.machinesOnline}
                max={data.summary.hostsTotal ?? data.summary.machinesTotal}
                label="Host availability"
                display={`${Math.round(((data.summary.hostsUp ?? data.summary.machinesOnline) / Math.max(1, data.summary.hostsTotal ?? data.summary.machinesTotal)) * 100)}%`}
                color="var(--good)"
              />
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

            {inventoryGroups.length > 0 && (
              <>
                <div className="monitor-toolbar mt-14">
                  <div>
                    <p className="monitor-eyebrow">Inventory · no exporter yet</p>
                    <h2 className="mt-1 text-2xl font-medium not-italic">其餘已盤點算力</h2>
                    <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
                      這些機器尚未安裝 GPU exporter，運行狀態由伺服器每 60 秒連線探測，
                      規格取自裝置清冊（{data.inventory?.updatedAt}）。
                    </p>
                  </div>
                </div>

                {inventoryGroups.map(([groupName, items]) => (
                  <section key={groupName} className="mt-7">
                    <div className="mb-3.5 flex items-center gap-3">
                      <span className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
                        {groupName}
                      </span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                        {items.filter((m) => m.online).length}/{items.length} 在線
                      </span>
                      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                    </div>
                    <div className="inventory-grid">
                      {items.map((m) => <InventoryCard key={m.id} m={m} />)}
                    </div>
                  </section>
                ))}
              </>
            )}

            <p className="mt-9 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              即時資料 Prometheus · nvidia_gpu_exporter · node_exporter　｜　規格資料 實驗室裝置清冊
            </p>
          </>
        )}
    </MonitoringChrome>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="monitor-kpi">
      <Icon className="mb-1 h-5 w-5" style={{ color: "var(--brand)" }} />
      <div className="monitor-kpi-label">{label}</div>
      <div className="monitor-kpi-value">{value}</div>
      {sub && <div className="text-xs leading-tight" style={{ color: "var(--text-faint)" }}>{sub}</div>}
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

function InventoryCard({ m }: { m: InventoryMachine }) {
  const specs = [
    m.cpu && { k: "CPU", v: m.cpuThreads ? `${m.cpu} · ${m.cpuThreads}T` : m.cpu },
    m.ramGB && { k: "RAM", v: `${m.ramGB} GB` },
    m.os && { k: "OS", v: m.os },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="inventory-card" style={{ opacity: m.online === false ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{m.label}</div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
            {[m.type, m.location].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span
          className="inventory-badge inline-flex items-center gap-1.5"
          style={m.online == null ? undefined : { color: m.online ? "var(--good)" : "var(--text-faint)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: m.online == null ? "var(--text-faint)" : m.online ? "var(--good)" : "var(--critical)",
              boxShadow: m.online ? "0 0 0 2.5px var(--good-soft)" : "none",
            }}
          />
          {m.online == null ? "探測中" : m.online ? "在線" : "離線"}
        </span>
      </div>

      {m.gpus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.gpus.map((g, i) => (
            <span
              key={`${g.model}-${i}`}
              className="rounded px-2 py-0.5 text-xs font-bold tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                color: g.class === "display-only" ? "var(--text-faint)" : "var(--brand-light)",
                background: g.class === "display-only" ? "var(--surface-2)" : "var(--brand-soft, rgba(49,197,207,.12))",
              }}
            >
              {g.model}
              {g.vramGB ? ` · ${g.vramGB}G` : ""}
              {g.passthrough ? " · 直通" : ""}
            </span>
          ))}
        </div>
      )}

      {m.online === false && m.lastSeen && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          最後回應 {new Date(m.lastSeen).toLocaleTimeString("zh-TW", { hour12: false })}
        </div>
      )}

      {specs.length > 0 && (
        <dl className="mt-3 space-y-1 text-xs">
          {specs.map((sp) => (
            <div key={sp.k} className="flex items-baseline justify-between gap-2">
              <dt style={{ color: "var(--text-faint)" }}>{sp.k}</dt>
              <dd className="truncate text-right tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{sp.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
