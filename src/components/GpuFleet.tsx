import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Activity, ArrowUpRight, Cpu, HardDrive, Search, Server, X } from "lucide-react";
import { MonitoringChrome } from "./MonitoringChrome";

type Gpu = {
  index?: string; name?: string; model: string; class?: string; vramGB?: number | null;
  memUsed?: number | null; memTotal?: number | null; util?: number | null;
  utilAvailable?: boolean; sampledAt?: string | null; temp?: number | null;
  power?: number | null; powerLimit?: number | null; driver?: string;
  migEnabled?: boolean; migProfile?: string | null; migSlices?: { profile?: string }[];
  passthrough?: boolean;
};
type Host = {
  id: string; label: string; location?: string; groupName?: string;
  type?: string; os?: string | null; cpu?: string | null; cpuThreads?: number | null;
  ramGB?: number | null; virtual?: boolean; edge?: boolean; monitored?: boolean;
  online: boolean | null; telemetryStatus?: string; checkedAt?: string | null;
  lastSeen?: string | null; latencyMs?: number | null;
  systemSampledAt?: string | null; cpuPercent?: number | null;
  ramUsed?: number | null; ramTotal?: number | null; gpus: Gpu[];
};
type Fleet = {
  updatedAt: string; prometheusStatus?: string;
  summary: { machinesTracked: number; gpusTotal: number; gpusOnline: number; gpusBusy: number;
    vramTotalGB: number; cpuThreadsTotal: number; ramTotalGB: number; edgeDevices: number;
    hostsUp: number; hostsTotal: number };
  machines: Host[];
  inventory?: { machines: Host[] } | null;
};
type Sample = { at: number; online: number | null; gpuUtil: number | null; cpuPercent: number | null; ramPercent: number | null };
type History = { startedAt: number | null; points: Sample[] };
type Filter = "all" | "busy" | "issues" | "unmonitored";
const GB = 1024 ** 3;
const fresh = (stamp: string | null | undefined, now: number) => !!stamp && Number.isFinite(Date.parse(stamp)) && now - Date.parse(stamp) >= -30_000 && now - Date.parse(stamp) < 120_000;
const fmt = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value)}%`;
const dateTime = (value: string | number | null | undefined) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "尚無紀錄";

function gpuLoad(host: Host, now: number): number | null {
  const live = host.gpus.filter(g => g.class !== "display-only" && g.utilAvailable !== false && fresh(g.sampledAt, now) && g.util != null).map(g => (g.util ?? 0) * 100);
  return live.length ? live.reduce((a, b) => a + b, 0) / live.length : null;
}
function state(host: Host) {
  if (host.online === false) return { text: "離線", key: "offline" };
  if (host.online == null) return { text: "探測中", key: "unknown" };
  if (host.telemetryStatus === "collector-error") return { text: "遙測異常", key: "warning" };
  if (host.telemetryStatus === "healthy") return { text: "即時監控", key: "live" };
  return { text: "連線正常", key: "reachable" };
}
function gpuName(host: Host) {
  const gpu = host.gpus.filter(g => g.class !== "display-only");
  if (!gpu.length) return host.edge ? "邊緣裝置" : host.virtual ? "虛擬機" : "CPU 節點";
  const models = [...new Set(gpu.map(g => g.model || g.name || "GPU"))];
  return `${gpu.length > 1 ? `${gpu.length} × ` : ""}${models.join(" / ")}`;
}

export function GpuFleet() {
  const [data, setData] = useState<Fleet | null>(null);
  const [error, setError] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [params, setParams] = useSearchParams();
  const visible = useRef(true);
  const selectedId = params.get("machine");

  useEffect(() => {
    let alive = true;
    let loading = false;
    const load = async () => {
      if (!visible.current || loading) return;
      loading = true;
      try {
        const response = await fetch("/api/gpus", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const payload = await response.json() as Fleet;
        if (alive) { setData(payload); setError(false); setUpdated(Date.now()); }
      } catch { if (alive) setError(true); }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 5_000);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    const onVisibility = () => { visible.current = document.visibilityState === "visible"; if (visible.current) void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { alive = false; clearInterval(timer); clearInterval(clock); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const hosts = useMemo(() => [...(data?.machines ?? []), ...(data?.inventory?.machines ?? [])], [data]);
  const selected = hosts.find(host => host.id === selectedId) ?? null;
  const filtered = hosts.filter(host => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle && !`${host.label} ${host.location ?? ""} ${host.groupName ?? ""} ${gpuName(host)}`.toLocaleLowerCase().includes(needle)) return false;
    const load = gpuLoad(host, now);
    if (filter === "busy") return load != null && load >= 20 || !host.gpus.length && host.cpuPercent != null && host.cpuPercent >= 20;
    if (filter === "issues") return ["offline", "warning", "unknown"].includes(state(host).key);
    if (filter === "unmonitored") return state(host).key === "reachable";
    return true;
  }).sort((a, b) => {
    const severity = (host: Host) => ({ offline: 0, warning: 1, unknown: 2, live: 3, reachable: 4 })[state(host).key] ?? 5;
    return severity(a) - severity(b) || a.label.localeCompare(b.label, "zh-TW", { numeric: true });
  });
  const select = (host: Host) => { const next = new URLSearchParams(params); next.set("machine", host.id); setParams(next); };
  const close = () => { const next = new URLSearchParams(params); next.delete("machine"); setParams(next); };

  return <MonitoringChrome eyebrow="HPC Lab · Fleet Monitor" title={<>算力<span style={{ color: "var(--brand-light)" }}>監控</span></>}
    description="一眼掌握每台節點；點選節點查看即時遙測、硬體規格與歷史走勢。"
    live={!!data && !error && !!updated && now - updated < 20_000}
    meta={<><div>每 5 秒更新遙測</div><div>連線狀態每 60 秒探測</div><div>更新 {updated ? dateTime(updated) : "連線中…"}</div></>}>
    {error && !data && <p role="alert" className="monitor-notice">監控資料暫時無法讀取，系統會自動重試。</p>}
    {!data && !error && <div className="panel p-8" role="status">正在載入節點…</div>}
    {data && <>
      {error && <p role="alert" className="monitor-notice">連線中斷，目前顯示上次取得的資料。</p>}
      {data.prometheusStatus === "unavailable" && <p role="alert" className="monitor-notice">部分遙測來源暫時無法更新；過期數值會顯示為未知。</p>}
      <div className="fleet-summary" aria-label="實驗室算力摘要">
        <Summary icon={Cpu} label="GPU 算力" value={`${data.summary.gpusTotal ?? 0} 張`} detail={`${data.summary.gpusOnline ?? 0} 張即時回報 · ${data.summary.vramTotalGB ?? 0} GB 顯存`} />
        <Summary icon={Server} label="實體機器" value={`${data.summary.machinesTracked ?? 0} 台`} detail={`${data.summary.hostsUp ?? 0}/${data.summary.hostsTotal ?? 0} 個端點可連線`} />
        <Summary icon={Activity} label="正在運算" value={`${data.summary.gpusBusy ?? 0} 張 GPU`} detail="使用率達 20%" />
        <Summary icon={HardDrive} label="系統記憶體" value={`${((data.summary.ramTotalGB ?? 0) / 1024).toFixed(1)} TB`} detail={`${data.summary.cpuThreadsTotal ?? 0} 條 CPU 執行緒`} />
      </div>

      <section className="fleet-overview" aria-labelledby="fleet-heading">
        <div className="fleet-headline"><div><p className="monitor-eyebrow">Node Overview</p><h2 id="fleet-heading">節點總覽 <span>{filtered.length} / {hosts.length}</span></h2></div><p>GPU 與 CPU 數值只顯示有效採樣；「連線正常」僅代表端點可連通。</p></div>
        <div className="fleet-controls">
          <label className="fleet-search"><Search size={17} aria-hidden="true" /><span className="sr-only">搜尋節點</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋機器、位置或 GPU 型號" /></label>
          <div className="fleet-filters" role="group" aria-label="篩選節點">
            {([["all", "全部"], ["busy", "運算中"], ["issues", "需注意"], ["unmonitored", "僅連線探測"]] as const).map(([key, label]) => <button key={key} type="button" data-active={filter === key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
        </div>
        <div className="fleet-cards">
          {filtered.map(host => <NodeRow key={host.id} host={host} now={now} onClick={() => select(host)} />)}
          {!filtered.length && <p className="fleet-empty">沒有符合條件的節點。試著清除搜尋或切換篩選。</p>}
        </div>
      </section>
      <p className="fleet-source">資料來源：GPU / node exporter、Prometheus、裝置清冊與連線探測。虛擬機直通 GPU 已歸到實體主機，容量不重複計算。</p>
      <AnimatePresence>{selected && <NodeDetail key={selected.id} host={selected} now={now} onClose={close} />}</AnimatePresence>
    </>}
  </MonitoringChrome>;
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof Cpu; label: string; value: string; detail: string }) {
  return <div className="fleet-summary-item"><Icon size={18} aria-hidden="true" /><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Meter({ value, label }: { value: number | null; label: string }) {
  return <div className="fleet-meter" aria-label={`${label} ${fmt(value)}`}><span style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} data-empty={value == null} /></div>;
}
function NodeRow({ host, now, onClick }: { host: Host; now: number; onClick: () => void }) {
  const status = state(host);
  const load = gpuLoad(host, now);
  const cpu = fresh(host.systemSampledAt, now) ? host.cpuPercent ?? null : null;
  return <button type="button" className="fleet-card" data-status={status.key} onClick={onClick} aria-label={`${host.label}，${status.text}，開啟詳情`}>
    <span className="fleet-card-top"><span className="fleet-card-name"><strong>{host.label}</strong>{host.virtual ? <em>VM</em> : null}</span><ArrowUpRight size={15} aria-hidden="true" /></span>
    <span className="fleet-card-location">{host.groupName || host.location || "實驗室"}</span>
    <span className="fleet-card-model">{gpuName(host)}</span>
    <span className="fleet-card-bottom"><span className="fleet-status" data-status={status.key}><i />{status.text}</span><span className="fleet-card-load">GPU <strong>{fmt(load)}</strong><Meter value={load} label="GPU 使用率" /></span></span>
    <span className="fleet-card-cpu">CPU {fmt(cpu)}</span>
  </button>;
}

function NodeDetail({ host, now, onClose }: { host: Host; now: number; onClose: () => void }) {
  const [tab, setTab] = useState<"live" | "history">("live");
  const [hours, setHours] = useState(24);
  const [history, setHistory] = useState<History | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') ?? [])].filter(element => !element.hasAttribute("disabled"));
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; previousFocus?.focus(); };
  }, []);
  useEffect(() => {
    if (tab !== "history") return;
    let alive = true;
    setHistory(null);
    fetch(`/api/monitoring/history/${encodeURIComponent(host.id)}?hours=${hours}`, { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((result: History) => { if (alive) { setHistory(result); setHistoryError(false); } })
      .catch(() => { if (alive) setHistoryError(true); });
    return () => { alive = false; };
  }, [tab, hours, host.id]);
  const status = state(host);
  const cpu = fresh(host.systemSampledAt, now) ? host.cpuPercent ?? null : null;
  const ram = fresh(host.systemSampledAt, now) && host.ramUsed != null && host.ramTotal ? host.ramUsed / host.ramTotal * 100 : null;
  const computeGpus = host.gpus.filter(g => g.class !== "display-only");
  return <motion.div className="fleet-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.aside ref={panelRef} role="dialog" aria-modal="true" aria-label={`${host.label} 節點詳情`} className="fleet-detail" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 300 }}>
      <header className="fleet-detail-header"><div><p className="monitor-eyebrow">Node Detail · {host.id}</p><h2>{host.label}</h2><p>{host.groupName || host.location || "實驗室"} {host.virtual ? "· 虛擬機，容量已計入實體主機" : ""}</p></div><button ref={closeRef} type="button" className="fleet-close" onClick={onClose} aria-label="關閉詳情"><X size={20} /></button></header>
      <div className="fleet-detail-status"><span className="fleet-status" data-status={status.key}><i />{status.text}</span><span>{host.online === false ? `最後回應 ${dateTime(host.lastSeen)}` : host.latencyMs != null ? `連線延遲 ${host.latencyMs} ms` : ""}</span></div>
      <div className="fleet-detail-tabs" role="tablist" aria-label="節點資料"><button role="tab" aria-selected={tab === "live"} onClick={() => setTab("live")}>目前狀態</button><button role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>歷史走勢</button></div>
      {tab === "live" ? <div className="fleet-detail-body">
        <div className="fleet-detail-metrics"><Metric label="GPU 平均使用率" value={fmt(gpuLoad(host, now))} note={computeGpus.some(g => g.migEnabled) ? "MIG 卡不提供整卡使用率" : "最新有效採樣"} /><Metric label="CPU 使用率" value={fmt(cpu)} note={host.systemSampledAt ? `採樣 ${dateTime(host.systemSampledAt)}` : "尚未接入遙測"} /><Metric label="記憶體使用率" value={fmt(ram)} note={host.ramTotal ? `${host.ramUsed && ram != null ? (host.ramUsed / GB).toFixed(1) : "—"} / ${(host.ramTotal / GB).toFixed(0)} GB` : host.ramGB ? `容量 ${host.ramGB} GB` : "尚無資料"} /></div>
        <h3>GPU 配置與運行</h3>
        {computeGpus.length ? computeGpus.map((gpu, index) => {
          const valid = fresh(gpu.sampledAt, now);
          const util = valid && gpu.utilAvailable !== false && gpu.util != null ? gpu.util * 100 : null;
          return <div className="fleet-gpu-detail" key={`${gpu.index ?? index}-${gpu.model}`}><div className="fleet-gpu-title"><strong>{gpu.model || gpu.name}</strong><span>{gpu.migEnabled ? `MIG · ${gpu.migProfile || "已啟用"}` : valid ? "即時採樣" : "未接入／採樣已過期"}</span></div><div className="fleet-gpu-load"><span>使用率 {gpu.migEnabled ? "MIG 不提供整卡數值" : fmt(util)}</span><Meter value={util} label="GPU 使用率" /></div><dl><div><dt>顯存</dt><dd>{valid && gpu.memUsed != null ? `${(gpu.memUsed / GB).toFixed(1)} / ` : "— / "}{gpu.memTotal ? `${(gpu.memTotal / GB).toFixed(0)} GB` : gpu.vramGB ? `${gpu.vramGB} GB` : "—"}</dd></div><div><dt>溫度</dt><dd>{valid && gpu.temp != null ? `${gpu.temp} °C` : "—"}</dd></div><div><dt>功耗</dt><dd>{valid && gpu.power != null ? `${gpu.power.toFixed(1)} W` : "—"}</dd></div><div><dt>採樣</dt><dd>{dateTime(gpu.sampledAt)}</dd></div></dl></div>;
        }) : <p className="fleet-detail-note">此節點沒有可計入算力的獨立 GPU。</p>}
        <h3>硬體與位置</h3><dl className="fleet-specs">{[["位置", host.location || host.groupName], ["類型", host.type], ["處理器", host.cpu], ["CPU 執行緒", host.cpuThreads], ["記憶體", host.ramGB ? `${host.ramGB} GB` : null], ["系統", host.os]].filter((row) => row[1] != null && row[1] !== "").map(([key, value]) => <div key={String(key)}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        {status.key === "reachable" && <p className="fleet-detail-note">此機器目前只確認連線，使用率與溫度尚無有效 exporter 採樣。</p>}
        {status.key === "offline" && <p className="fleet-detail-note">連線探測未回應；最後回應時間：{dateTime(host.lastSeen)}。</p>}
      </div> : <div className="fleet-detail-body"><div className="fleet-range" role="group" aria-label="歷史時間範圍">{[[1, "1 小時"], [6, "6 小時"], [24, "24 小時"], [168, "7 天"], [720, "30 天"]].map(([value, label]) => <button key={value} data-active={hours === value} onClick={() => setHours(Number(value))}>{label}</button>)}</div>
        {historyError ? <p className="fleet-detail-note" role="alert">歷史服務暫時無法讀取，請稍後再試。</p> : !history ? <p className="fleet-detail-note">正在讀取歷史紀錄…</p> : !history.points.length ? <p className="fleet-detail-note">這段時間尚未累積採樣。歷史紀錄從服務啟用後開始保存，不回填舊數值。</p> : <><p className="fleet-detail-note">實際採樣 {history.points.length} 筆 · 最早 {dateTime(history.startedAt)} · 每分鐘保存一次，保留 30 天。</p><HistoryChart points={history.points} field="gpuUtil" label="GPU 平均使用率" /><HistoryChart points={history.points} field="cpuPercent" label="CPU 使用率" /><HistoryChart points={history.points} field="ramPercent" label="記憶體使用率" /></>}
      </div>}
    </motion.aside>
  </motion.div>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="fleet-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function HistoryChart({ points, field, label }: { points: Sample[]; field: "gpuUtil" | "cpuPercent" | "ramPercent"; label: string }) {
  const valid = points.filter(point => point[field] != null);
  if (!valid.length) return <div className="fleet-chart"><div><strong>{label}</strong><span>沒有有效採樣</span></div></div>;
  const min = points[0].at;
  const span = Math.max(1, points[points.length - 1].at - min);
  // Break the line where telemetry is missing or the collector skipped an interval.
  const segments: Sample[][] = [];
  points.forEach((point, index) => {
    if (point[field] == null) return;
    if (!index || points[index - 1][field] == null || point.at - points[index - 1].at > 120_000) segments.push([]);
    segments[segments.length - 1].push(point);
  });
  const x = (at: number) => 8 + (at - min) / span * 584;
  const y = (value: number) => 100 - Math.max(0, Math.min(100, value)) * .8;
  return <div className="fleet-chart"><div><strong>{label}</strong><span>目前 {fmt(valid[valid.length - 1][field])}</span></div><svg viewBox="0 0 600 112" role="img" aria-label={`${label}歷史趨勢`} preserveAspectRatio="none"><path d="M 8 20 H 592 M 8 60 H 592 M 8 100 H 592" stroke="currentColor" opacity=".12" strokeWidth="1" fill="none" />{segments.map((segment, index) => <polyline key={index} points={segment.map(point => `${x(point.at)},${y(point[field] as number)}`).join(" ")} fill="none" stroke="var(--brand-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</svg><small>{dateTime(points[0].at)} — {dateTime(points[points.length - 1].at)}</small></div>;
}
