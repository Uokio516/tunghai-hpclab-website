import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Cpu, Server, Activity, HardDrive, AlertTriangle, MemoryStick } from "lucide-react";
import { MonitoringChrome } from "./MonitoringChrome";
import type { GpuTelemetry } from "../../gpu-telemetry";

type MigInfo = Partial<GpuTelemetry> & { migProfileUpdatedAt?: string };

type Gpu = MigInfo & {
  index: string; name: string; model: string; driver: string;
  util: number | null; memUsed: number | null; memTotal: number | null;
  temp: number | null; power: number | null; powerLimit: number | null; fan: number | null;
  sampledAt?: string | null;
  class?: string;
};
type Machine = {
  id: string; label: string; location: string;
  online: boolean; cpuPercent: number | null; ramUsed: number | null; ramTotal: number | null;
  telemetryStatus?: "healthy" | "collector-error" | "awaiting-data";
  telemetryCode?: number | null;
  systemSampledAt?: string | null;
  gpus: Gpu[];
};
type InventoryGpu = MigInfo & { model: string; vramGB: number | null; class: string; passthrough: boolean };
type InventoryMachine = {
  id: string; label: string; owner: string; type: string; os: string | null;
  location: string; group: string; groupName: string;
  cpu: string | null; cpuThreads: number | null; ramGB: number | null;
  gpus: InventoryGpu[]; virtual: boolean; countsForCapacity: boolean; edge: boolean;
  online: boolean | null; checkedAt: string | null; lastSeen: string | null; latencyMs: number | null;
  monitored?: boolean; telemetryStatus?: "healthy" | "collector-error" | "awaiting-data";
  sampledAt?: string | null; systemSampledAt?: string | null;
  cpuPercent?: number | null; ramUsed?: number | null; ramTotal?: number | null;
  sharedMemory?: { used: number | null; total: number | null; sampledAt: string } | null;
};
type Data = {
  updatedAt: string; source: string;
  prometheusStatus?: string;
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

const REFRESH_MS = 5_000;
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
  const [view, setView] = useState<"cards" | "table">("cards");
  const [now, setNow] = useState(Date.now());
  const visible = useRef(true);

  useEffect(() => {
    let alive = true;
    let loading = false;
    const controller = new AbortController();
    const load = async () => {
      if (!visible.current || loading) return;
      loading = true;
      try {
        const r = await fetch("/api/gpus", { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Data;
        if (!alive) return;
        setData(j); setError(false); setAt(new Date());
      } catch { if (alive) setError(true); }
      finally { loading = false; }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const onVisibility = () => {
      visible.current = document.visibilityState === "visible";
      if (visible.current) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(clock);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const visibleMachines = data?.machines.filter((machine) => {
    if (filter === "issues") return !machine.online || machine.telemetryStatus !== "healthy";
    if (filter === "active") return machine.gpus.some((gpu) => (gpu.util ?? 0) >= 0.2);
    if (filter === "idle") return machine.online && machine.gpus.length > 0 && machine.gpus.every((gpu) => gpu.util != null && gpu.util < 0.2);
    return true;
  }) ?? [];

  // Group the un-instrumented machines by room so the page reads as a floor plan
  // rather than one long undifferentiated list.
  const inventoryGroups = (() => {
    const order = ["圖書館機房", "ST430 機房", "叢集實體節點", "ST312 研究室", "ST429 研究室", "辦公室"];
    const by = new Map<string, InventoryMachine[]>();
    const matches = (m: InventoryMachine) => {
      const gpus = m.gpus.filter(g => g.class !== "display-only");
      const current = (g: InventoryGpu) => !!g.sampledAt && now - Date.parse(g.sampledAt) < 120_000;
      if (filter === "issues") return m.online === false || !!m.monitored && m.telemetryStatus !== "healthy";
      if (filter === "active") return gpus.some(g => current(g) && (g.util ?? 0) >= .2) || !gpus.length && (m.cpuPercent ?? 0) >= 20;
      if (filter === "idle") return m.online === true && (gpus.length ? gpus.every(g => current(g) && g.util != null && g.util < .2) : m.cpuPercent != null && m.cpuPercent < 20);
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
      eyebrow="Lab Compute Fleet · Live Telemetry"
      title={<>實驗室<span style={{ color: "var(--brand-light)" }}>全部算力</span></>}
      description="即時 GPU 遙測與全實驗室算力盤點。使用率採最新一次採樣；未接遙測的機器提供連線狀態與規格。"
      live={!!data && !error && !!at && now - at.getTime() < 20_000}
      meta={<><div><RefreshCw className="mr-2 inline h-3 w-3" />每 5 秒更新</div><div>{at ? `取得資料 ${at.toLocaleTimeString("zh-TW", { hour12: false })}` : "連線中…"}</div><div>主機連線每 60 秒探測</div></>}
    >
        {error && !data && <div className="panel p-8 text-center text-base" style={{ color: "var(--critical)" }}>監控資料暫時無法讀取。</div>}
        {!error && !data && <div className="panel animate-pulse p-8 text-center text-base" style={{ color: "var(--text-dim)" }}>載入中…</div>}
        {data && (error || (at && now - at.getTime() > 20_000)) && <p role="alert" className="monitor-notice">資料更新中斷，以下保留上次結果。系統會自動重試。</p>}
        {data?.prometheusStatus === "unavailable" && <p role="alert" className="monitor-notice">Prometheus 來源暫時無法更新；其他機器的即時監控持續運作。保留的測量會標示採樣時間，過期後顯示未知。</p>}

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

            <div className="monitor-toolbar">
              <div>
                <p className="monitor-eyebrow">Compute nodes</p>
                <h2 className="mt-1 text-2xl font-medium not-italic">算力總覽</h2>
                <div className="mt-3 flex gap-2" role="group" aria-label="顯示方式">
                  <button className="monitor-filter" aria-pressed={view === "cards"} data-active={view === "cards"} onClick={() => setView("cards")}>卡片</button>
                  <button className="monitor-filter" aria-pressed={view === "table"} data-active={view === "table"} onClick={() => setView("table")}>表格</button>
                </div>
              </div>
              <div className="monitor-filters">
                {([
                  ["all", "全部"],
                  ["active", "運算中"],
                  ["idle", "閒置"],
                  ["issues", "需注意"],
                ] as const).map(([id, label]) => (
                  <button key={id} className="monitor-filter" aria-pressed={filter === id} data-active={filter === id} onClick={() => setFilter(id)}>
                    {id === "issues" && <AlertTriangle className="mr-1 inline h-3 w-3" />}{label}
                  </button>
                ))}
              </div>
            </div>

            {view === "table" ? <FleetTable machines={visibleMachines} inventory={inventoryGroups.flatMap(([, items]) => items)} now={now} /> : <>
            <div className="machine-grid">
              {visibleMachines.map((m, i) => <MachineCard key={m.id} m={m} delay={i * 0.03} />)}
            </div>

            {inventoryGroups.length > 0 && (
              <>
                <div className="monitor-toolbar mt-14">
                  <div>
                    <p className="monitor-eyebrow">Fleet · Exporters + Inventory</p>
                    <h2 className="mt-1 text-2xl font-medium not-italic">全實驗室運行監控</h2>
                    <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
                      已接 exporter 的機器每 5 秒收集 CPU、記憶體與 GPU 遙測；其餘機器每 60 秒探測連線。
                      VM 的 GPU 遙測合併到實體主機，容量依裝置清冊計算（{data.inventory?.updatedAt}）。
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
                      {items.map((m) => <InventoryCard key={m.id} m={m} now={now} />)}
                    </div>
                  </section>
                ))}
              </>
            )}
            </>}
            {visibleMachines.length === 0 && inventoryGroups.length === 0 && <p className="panel p-8 text-center" style={{ color: "var(--text-dim)" }}>目前沒有符合篩選條件的機器。</p>}

            <p className="mt-9 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              即時資料 Prometheus · NVIDIA／Jetson exporter · node_exporter　｜　規格資料 實驗室裝置清冊
            </p>
          </>
        )}
    </MonitoringChrome>
  );
}

function FleetTable({ machines, inventory, now }: { machines: Machine[]; inventory: InventoryMachine[]; now: number }) {
  const fresh = (stamp?: string | null) => !!stamp && now - Date.parse(stamp) >= -30_000 && now - Date.parse(stamp) < 120_000;
  const hostMemory = (m: { ramUsed?: number | null; ramTotal?: number | null; systemSampledAt?: string | null }) => m.ramTotal
    ? `${fresh(m.systemSampledAt) && m.ramUsed != null ? (m.ramUsed / GB).toFixed(1) : "—"} / ${(m.ramTotal / GB).toFixed(0)} GB` : "—";
  const rows = [
    ...machines.flatMap((m) => (m.gpus.length ? m.gpus : [null]).map((g) => ({
      key: `${m.id}-${g?.index ?? "host"}`, label: m.label, location: m.location,
      status: !m.online ? "離線" : m.telemetryStatus === "collector-error" ? "遙測異常" : "在線",
      model: `${g?.model ?? "—"}${g?.migEnabled ? " · MIG" : ""}`, util: g && g.utilAvailable !== false && g.sampledAt && now - Date.parse(g.sampledAt) < 120_000 ? g.util : null,
      memory: g?.memTotal ? `${g.memUsed == null ? "—" : (g.memUsed / GB).toFixed(1)} / ${(g.memTotal / GB).toFixed(0)} GB` : "—",
      cpu: fresh(m.systemSampledAt) && m.cpuPercent != null ? formatPercent(m.cpuPercent) : "—", ram: hostMemory(m),
      updated: g?.sampledAt ? new Date(g.sampledAt).toLocaleTimeString("zh-TW", { hour12: false }) : "等待採樣",
      note: g?.migEnabled ? `MIG · ${g.migProfile ?? "配置待讀取"}` : g?.sampledAt && now - Date.parse(g.sampledAt) >= 120_000 ? "資料已過期" : "即時遙測",
      utilNote: g?.migEnabled ? "MIG 不提供整卡使用率" : null,
      temperature: g?.sampledAt && now - Date.parse(g.sampledAt) < 120_000 && g.temp != null ? `${g.temp}°C` : "—",
      power: g?.sampledAt && now - Date.parse(g.sampledAt) < 120_000 && g.power != null ? `${g.power.toFixed(1)} W` : "—",
    }))),
    ...inventory.flatMap((m) => (m.gpus.length ? m.gpus : [null]).map((g, index) => {
      const stamp = g?.sampledAt ?? m.systemSampledAt ?? m.sampledAt ?? m.checkedAt;
      return {
        key: `${m.id}-${index}`, label: `${m.label}${m.virtual ? " · VM" : ""}`, location: m.location || m.groupName,
        status: m.online === false ? "離線" : m.monitored && m.telemetryStatus === "collector-error" ? "遙測異常" : m.online == null ? "探測中" : "在線",
        model: g ? `${g.model}${g.migEnabled ? ` · MIG ${g.migProfile ?? `${g.migSlices?.length ?? 0} 切片`}` : ""}${g.class === "display-only" ? "（顯示用）" : ""}` : "CPU",
        util: g && fresh(g.sampledAt) && g.utilAvailable !== false ? g.util ?? null : null,
        memory: g?.class === "edge" ? "與系統共享" : g?.memTotal
          ? `${fresh(g.sampledAt) && g.memUsed != null ? (g.memUsed / GB).toFixed(1) : "—"} / ${(g.memTotal / GB).toFixed(0)} GB` : g?.vramGB ? `${g.vramGB} GB` : "—",
        cpu: fresh(m.systemSampledAt) && m.cpuPercent != null ? formatPercent(m.cpuPercent) : m.cpuThreads ? `${m.cpuThreads} 緒` : "—", ram: hostMemory(m),
        updated: stamp ? new Date(stamp).toLocaleTimeString("zh-TW", { hour12: false }) : "等待採樣",
        note: `${m.monitored ? fresh(g?.sampledAt ?? m.sampledAt) ? "即時遙測" : "等待採樣／資料已過期" : "規格／連線探測"}${m.virtual ? " · 容量已計於實體主機" : ""}${m.online === false ? ` · 最後回應 ${m.lastSeen ? new Date(m.lastSeen).toLocaleString("zh-TW", { hour12: false }) : "尚無紀錄"}` : ""}`,
        utilNote: g?.migEnabled ? "MIG 不提供整卡使用率" : g?.utilAvailable === false ? "不支援使用率" : null,
        temperature: g && fresh(g.sampledAt) && g.temp != null ? `${g.temp}°C` : "—",
        power: g && fresh(g.sampledAt) && g.power != null ? `${g.power.toFixed(1)} W` : "—",
      };
    })),
  ];
  return <div className="fleet-table-scroll" tabIndex={0} role="region" aria-label="算力監控表，可水平捲動">
    <table className="fleet-table">
      <caption>最新算力與運行狀態 · 未接 GPU 遙測的機器不推估使用率</caption>
      <thead><tr>{["機器／位置", "狀態", "GPU／MIG 配置", "GPU 使用率", "顯存使用／容量", "溫度", "功耗", "CPU 使用率／規格", "系統記憶體", "採樣／探測時間"].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key} data-offline={r.status === "離線"}>
        <th scope="row">{r.label}<small>{r.location}</small></th>
        <td><span className="table-status" data-status={r.status}>{r.status}</span></td>
        <td>{r.model}</td><td>{r.utilNote ?? (r.util == null ? "—" : formatPercent(r.util * 100))}</td>
        <td>{r.memory}</td><td>{r.temperature}</td><td>{r.power}</td><td>{r.cpu}</td><td>{r.ram}</td><td>{r.updated}<small>{r.note}</small></td>
      </tr>)}</tbody>
    </table>
  </div>;
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
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: m.online ? 1 : 0.6, y: 0 }} transition={{ duration: 0.4, delay }}
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

      {m.online && <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}><SystemMeters m={m} /></div>}

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
  if (g.migEnabled) return <div className="p-5"><MigPanel gpu={g} /></div>;
  const stale = !g.sampledAt || Date.now() - Date.parse(g.sampledAt) > 120_000;
  const util = stale || g.utilAvailable === false ? null : g.util;
  const memUsed = stale ? null : g.memUsed;
  const temp = stale ? null : g.temp;
  const power = stale ? null : g.power;
  const memPct = memUsed != null && g.memTotal ? memUsed / g.memTotal : 0;
  return (
    <div className="p-5" style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}>
      <div className="mb-2.5 flex items-center justify-between text-sm">
        <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>GPU {g.index}</span>
        <div className="flex items-center gap-3.5 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
          <span style={{ color: tempColor(temp) }}>{temp != null ? `${temp}°C` : "—"}</span>
          <span style={{ color: "var(--text-dim)" }}>{power != null ? `${Math.round(power)}W` : "—"}</span>
          {g.fan != null && <span style={{ color: "var(--text-faint)" }}>風扇 {Math.round(g.fan * 100)}%</span>}
        </div>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span style={{ color: "var(--text-dim)" }}>
          使用率 <small style={{ color: "var(--text-faint)" }}>最新採樣</small>
        </span>
        <span className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
          {g.utilAvailable === false ? "不支援" : util == null ? "—" : formatPercent(util * 100)}
        </span>
      </div>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(util ?? 0) * 100}%`, background: loadColor(util) }} />
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        {g.sampledAt ? `採樣 ${new Date(g.sampledAt).toLocaleTimeString("zh-TW", { hour12: false })}${stale ? " · 資料已過期" : ""}` : "等待遙測資料"}
      </p>

      {g.class === "edge" ? <p className="text-xs" style={{ color: "var(--text-faint)" }}>GPU 與 CPU 共享系統記憶體</p> : <><div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span style={{ color: "var(--text-dim)" }}>記憶體</span>
        <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
          {memUsed != null && g.memTotal ? `${(memUsed / GB).toFixed(1)} / ${(g.memTotal / GB).toFixed(0)} GB` : "—"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${memPct * 100}%`, background: "var(--brand)" }} />
      </div></>}
    </div>
  );
}

function MigPanel({ gpu }: { gpu: MigInfo & { model?: string; vramGB?: number | null } }) {
  const fresh = !!gpu.sampledAt && Date.now() - Date.parse(gpu.sampledAt) < 120_000;
  const liveSlices = gpu.migSlices ?? [];
  const segments = liveSlices.length ? liveSlices.map(slice => ({
    profile: slice.profile, capacity: slice.memTotal ?? Number(slice.profile.match(/\.(\d+(?:\.\d+)?)gb/)?.[1] ?? 1) * GB,
    used: fresh ? slice.memUsed : null, giId: slice.giId, ciId: slice.ciId, sm: slice.sm,
  })) : [...(gpu.migProfile ?? "").matchAll(/(\d+g\.(\d+(?:\.\d+)?)gb)(?:\s*x(\d+))?/g)].flatMap(match =>
    Array.from({ length: Math.min(128, Number(match[3] ?? 1)) }, () => ({ profile: match[1], capacity: Number(match[2]) * GB, used: null, giId: null, ciId: null, sm: null }))
  );
  const physicalCapacity = gpu.memTotal ?? (gpu.vramGB ? gpu.vramGB * GB : 0);
  const reserve = Math.max(0, physicalCapacity - segments.reduce((sum, segment) => sum + segment.capacity, 0));
  return <div className="mig-panel">
    <div className="flex items-center justify-between gap-2"><strong className="text-xs">MIG 切片配置</strong><span className="inventory-badge">{gpu.migProfile ?? (segments.length ? `${segments.length} 個切片` : "待讀取")}</span></div>
    <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>MIG 模式下不提供整卡使用率</p>
    {segments.length > 0 && <div className="mig-segments" aria-label="MIG 切片容量比例，不代表使用率">
      {segments.map((slice, index) => <div key={`${slice.giId ?? index}-${slice.ciId ?? index}`} className="mig-segment" style={{ flex: slice.capacity || 1 }} title={`${slice.profile}${slice.giId != null ? ` · GI ${slice.giId} / CI ${slice.ciId}` : ""}`}>
        {slice.used != null && slice.capacity > 0 && <span className="mig-fill" style={{ width: `${Math.min(100, slice.used / slice.capacity * 100)}%` }} />}
        <span className="mig-profile">{slice.profile}</span>
      </div>)}
      {reserve > 0 && <div className="mig-segment mig-reserve" style={{ flex: reserve }} title="未配置或系統保留容量"><span className="mig-profile">保留</span></div>}
    </div>}
    {liveSlices.length > 0 && <ul className="mig-slice-list">{segments.map((slice, index) => <li key={`${slice.giId}-${slice.ciId}-${index}`}>
      <span>{slice.profile} · GI {slice.giId} / CI {slice.ciId}{slice.sm != null ? ` · 配置 ${slice.sm} SM` : ""}</span>
      <span>{slice.used == null ? "顯存用量待更新" : `${(slice.used / 1024 ** 2).toFixed(0)} / ${(slice.capacity / 1024 ** 2).toFixed(0)} MiB`}</span>
    </li>)}</ul>}
    <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
      {gpu.sampledAt ? `採樣 ${new Date(gpu.sampledAt).toLocaleTimeString("zh-TW", { hour12: false })}${fresh ? "" : " · 資料已過期"}` : `盤點配置 ${gpu.migProfileUpdatedAt ?? "日期待確認"} · 尚未接即時切片遙測`}
    </p>
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
      <span>顯存<br /><strong>{fresh && gpu.memUsed != null ? `${(gpu.memUsed / 1024 ** 2).toFixed(0)} MiB` : "—"}</strong></span>
      <span>溫度<br /><strong>{fresh && gpu.temp != null ? `${gpu.temp}°C` : "—"}</strong></span>
      <span>功耗<br /><strong>{fresh && gpu.power != null ? `${gpu.power.toFixed(1)} W` : "—"}</strong></span>
    </div>
  </div>;
}

function SystemMeters({ m, now = Date.now() }: { m: { cpuPercent?: number | null; ramUsed?: number | null; ramTotal?: number | null; systemSampledAt?: string | null }; now?: number }) {
  const fresh = !!m.systemSampledAt && now - Date.parse(m.systemSampledAt) < 120_000;
  const cpu = fresh ? m.cpuPercent : null;
  const used = fresh ? m.ramUsed : null;
  if (m.cpuPercent == null && m.ramTotal == null) return null;
  return <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
    <div>
      <div className="mb-1.5 flex justify-between gap-2"><span style={{ color: "var(--text-dim)" }}>CPU 使用率</span><strong>{cpu != null ? formatPercent(cpu) : "—"}</strong></div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full transition-all" style={{ width: `${cpu ?? 0}%`, background: loadColor(cpu != null ? cpu / 100 : null) }} /></div>
    </div>
    <div>
      <div className="mb-1.5 flex justify-between gap-2"><span style={{ color: "var(--text-dim)" }}>系統記憶體</span><strong>{used != null && m.ramTotal ? `${(used / GB).toFixed(1)} / ${(m.ramTotal / GB).toFixed(0)} GB` : "—"}</strong></div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full transition-all" style={{ width: `${used != null && m.ramTotal ? Math.min(100, used / m.ramTotal * 100) : 0}%`, background: "var(--brand)" }} /></div>
    </div>
    <p className="col-span-2" style={{ color: "var(--text-faint)" }}>{m.systemSampledAt ? `系統採樣 ${new Date(m.systemSampledAt).toLocaleTimeString("zh-TW", { hour12: false })}${fresh ? "" : " · 資料已過期"}` : "等待系統採樣"}</p>
  </div>;
}

function InventoryCard({ m, now }: { m: InventoryMachine; now: number }) {
  const specs = [
    m.cpu && { k: "CPU", v: m.cpuThreads ? `${m.cpu} · ${m.cpuThreads}T` : m.cpu },
    m.ramGB && { k: "RAM", v: `${m.ramGB} GB` },
    m.os && { k: "OS", v: m.os },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="inventory-card" style={{ opacity: m.online === false ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{m.label}{m.virtual ? " · VM" : ""}</div>
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

      {m.online === true && m.latencyMs != null && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          連線延遲 {m.latencyMs} ms
        </div>
      )}

      {m.monitored && <div className="mt-3 text-xs" style={{ color: m.telemetryStatus === "healthy" ? "var(--good)" : "var(--warn)" }}>
        {m.telemetryStatus === "healthy" ? "即時監控" : m.telemetryStatus === "collector-error" ? "遙測暫時無法更新" : "等待 exporter 採樣"}
        {m.virtual ? " · 容量已計於實體主機" : ""}
      </div>}

      <SystemMeters m={m} now={now} />

      {m.sharedMemory && m.ramTotal == null && <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
        共享記憶體 {m.sharedMemory.used != null && now - Date.parse(m.sharedMemory.sampledAt) < 120_000 ? `${(m.sharedMemory.used / GB).toFixed(1)} / ${((m.sharedMemory.total ?? 0) / GB).toFixed(1)} GB` : "等待採樣"}
      </p>}

      {m.gpus.filter(gpu => !gpu.migEnabled && gpu.sampledAt && gpu.class !== "display-only").map((gpu, index) => <GpuRow key={`gpu-${index}`} last={true} g={{
        ...gpu, index: gpu.index ?? String(index), name: gpu.model, model: gpu.model, driver: "",
        util: gpu.util ?? null, memUsed: gpu.memUsed ?? null, memTotal: gpu.memTotal ?? null,
        temp: gpu.temp ?? null, power: gpu.power ?? null, powerLimit: gpu.powerLimit ?? null, fan: null,
      }} />)}

      {m.gpus.filter(gpu => gpu.migEnabled).map((gpu, index) => <MigPanel key={`mig-${index}`} gpu={gpu} />)}

      {m.online === false && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          最後回應 {m.lastSeen ? new Date(m.lastSeen).toLocaleString("zh-TW", { hour12: false }) : "尚無成功連線紀錄"}
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
