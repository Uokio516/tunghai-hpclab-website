import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Server, Cpu, MemoryStick, Cog, Database, Box, Layers, Clock3 } from "lucide-react";
import { MonitoringChrome } from "./MonitoringChrome";
import { useLocale, type Language } from "../lib/locale";

// ---- types ----
type Meter = { label: string; value: string; pct: number; level?: string };
type ClusterNode = {
  name: string; role?: string; status: string;
  cpu: string; ram: string; gpu?: string; gpuLevel?: string; highlight?: boolean;
};
type VM = { name: string; use: string; node: string; state: string };
type Cluster = {
  id: string; name: string; subtitle: string; accent: string; stack: string;
  status: string; statusLevel: string;
  quick: { v: string; l: string }[];
  nodes: ClusterNode[]; meters: Meter[]; services?: string[]; vms?: VM[];
};
type Summary = {
  physicalNodes: number; cpuThreads: number; memoryGB: number;
  gpus: number; gpusPending: number; cephTiB: number;
  vmsTotal: number; vmsRunning: number; platforms: number;
  // Captions used to be hardcoded in the component and went stale as soon as a
  // node was added; the snapshot now carries them.
  notes?: Partial<Record<"physicalNodes" | "cpuThreads" | "memoryGB" | "gpus" | "cephTiB" | "vms" | "platforms", string>>;
};
type ClusterData = { updatedAt: string; source: string; summary: Summary; clusters: Cluster[] };

const snapshotTerms: [string, string][] = [
  ["機房實體節點合計", "Physical server-room nodes total"],
  ["運行 / 總數", "Running / Total"],
  ["GPU 運算叢集", "GPU compute cluster"],
  ["CubeCOS 超融合雲叢集", "CubeCOS hyperconverged cloud cluster"],
  ["Proxmox 虛擬化叢集", "Proxmox virtualization cluster"],
  ["Proxmox 備份伺服器", "Proxmox backup server"],
  ["CPU 執行緒", "CPU threads"], ["GPU 已註冊", "GPUs registered"],
  ["GPU 直通", "GPU passthrough"], ["備份來源", "Backup source"],
  ["版本", "Version"],
  ["備份快照", "Backup snapshots"], ["備份池", "Backup pool"],
  ["超融合雲", "hyperconverged cloud"], ["虛擬化", "virtualization"],
  ["實體卡", "physical GPUs"], ["裸機", "bare-metal"],
  ["伺服器", "server"], ["叢集", "cluster"], ["記憶體", "memory"],
  ["直通", "passthrough"], ["借用", "loaned"], ["承載", "hosting"],
  ["對外服務", "public services"], ["已註冊", "registered"],
  ["最大", "maximum"], ["上線", "online"], ["健康", "health"],
  ["來源", "source"], ["快照", "snapshots"], ["每日", "daily"],
  ["池", " pool"], [" 張", ""],
  ["待加入", "pending"], ["可排程", "schedulable"],
  ["合計", "Total"], ["運行中", "Running"], ["服務正常", "Services healthy"],
  ["節點 Ready", "Nodes ready"], ["容量", "capacity"], ["節點", "nodes"],
  ["使用率", "utilization"], ["備份", "backup"], ["監控", "monitoring"],
  ["儲存", "storage"], ["虛擬機", "VMs"], ["待確認", "pending confirmation"],
  ["運算", "compute"], ["控制平台", "control platform"], ["工作負載", "workloads"],
  ["實驗室", "lab"], ["機房", "server room"], ["管理", "management"],
];
function localizeSnapshotText(value: string | undefined, language: Language) {
  if (!value || language !== "en") return value ?? "";
  return snapshotTerms.reduce((result, [zh, en]) => result.replaceAll(zh, en), value);
}

export function Infrastructure() {
  const { language, t } = useLocale();
  const [data, setData] = useState<ClusterData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/cluster-status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as ClusterData;
        if (!alive) return;
        setData(json);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <MonitoringChrome
      eyebrow="Multi-platform Infrastructure"
      title={language === "en" ? <>Lab <span style={{ color: "var(--brand-light)" }}>Infrastructure</span></> : <>實驗室<span style={{ color: "var(--brand-light)" }}>運算基礎設施</span></>}
      description={t("從 CubeCOS 超融合雲、Proxmox 虛擬化叢集到獨立備份系統，呈現實驗室跨平台運算資源、工作負載與儲存健康。", "Explore computing resources, workloads and storage health across CubeCOS, Proxmox and the dedicated backup system.")}
      live={false}
      meta={<><div><Clock3 className="mr-2 inline h-3 w-3" />{t("歷史盤點快照", "Inventory snapshot")}</div><div>{data ? `${t("資料日期", "As of")} ${data.updatedAt}` : t("讀取中…", "Loading…")}</div><div>{t("非即時叢集狀態", "Historical cluster status")}</div></>}
    >

        {error && !data && (
          <div className="panel p-8 text-center text-base" style={{ color: "var(--critical)" }}>
            {t("無法讀取叢集狀態，請稍後再試。", "Could not load cluster status. Please try again later.")}
          </div>
        )}
        {!error && !data && (
          <div className="panel animate-pulse p-8 text-center text-base" style={{ color: "var(--text-dim)" }}>{t("載入中…", "Loading…")}</div>
        )}

        {data && (
          <>
            <SummaryStrip s={data.summary} />
            <div className="cluster-jump">
              {data.clusters.map((cluster) => (
                <a key={cluster.id} href={`#cluster-${cluster.id}`} style={{ borderColor: `${cluster.accent}44` }}>
                  <strong style={{ color: cluster.accent }}>{localizeSnapshotText(cluster.name, language)}</strong>
                  <span>{localizeSnapshotText(cluster.status, language)} · {cluster.nodes.length} {t("節點", "nodes")}</span>
                </a>
              ))}
            </div>
            {data.source === "snapshot" && (
              <div className="snapshot-warning">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--warn)" }} />
                <div><strong style={{ color: "var(--warn)" }}>{t("歷史快照，非即時監控", "Historical snapshot, not live monitoring")}</strong><br />{t(`目前只顯示最後一次成功盤點結果（${data.updatedAt}）。頁面不會宣稱自動更新；待 Proxmox／OpenStack 唯讀 API 正式串接後，才會啟用即時狀態。`, `Showing the last successful inventory (${data.updatedAt}). Live status will be enabled after read-only Proxmox and OpenStack APIs are connected.`)}</div>
              </div>
            )}

            <div className="mt-10 space-y-6">
              {data.clusters.map((c, i) => (
                <ClusterPanel key={c.id} c={c} delay={i * 0.05} />
              ))}
            </div>

            <p className="mt-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              {t("資料經 SSH / OpenStack / Ceph / Proxmox API 收集 · 快照模式", "Collected via SSH and OpenStack, Ceph and Proxmox APIs · Snapshot mode")}
            </p>
          </>
        )}
    </MonitoringChrome>
  );
}

function SummaryStrip({ s }: { s: Summary }) {
  const { language, t } = useLocale();
  const n = s.notes ?? {};
  const items = [
    { icon: Server, label: t("實體節點", "Physical nodes"), value: String(s.physicalNodes), sub: localizeSnapshotText(n.physicalNodes ?? "合計", language) },
    { icon: Cpu, label: t("CPU 執行緒", "CPU threads"), value: String(s.cpuThreads), sub: localizeSnapshotText(n.cpuThreads ?? "合計", language) },
    { icon: MemoryStick, label: t("記憶體", "Memory"), value: (s.memoryGB / 1000).toFixed(1), sub: localizeSnapshotText(n.memoryGB ?? "TB · ≈ " + s.memoryGB.toLocaleString() + " GB", language) },
    { icon: Cog, label: "GPU", value: s.gpusPending ? `${s.gpus}+${s.gpusPending}` : String(s.gpus), sub: localizeSnapshotText(n.gpus ?? "合計", language) },
    { icon: Database, label: t("Ceph 儲存", "Ceph storage"), value: s.cephTiB.toFixed(1), sub: localizeSnapshotText(n.cephTiB ?? "TiB", language) },
    { icon: Box, label: t("虛擬機", "Virtual machines"), value: `${s.vmsRunning}/${s.vmsTotal}`, sub: localizeSnapshotText(n.vms ?? "運行 / 總數", language) },
    { icon: Layers, label: t("虛擬化平台", "Virtualization platforms"), value: String(s.platforms), sub: localizeSnapshotText(n.platforms ?? "合計", language) },
  ];
  return (
    <div className="monitor-kpi-grid">
      {items.map((it) => (
        <div key={it.label} className="monitor-kpi">
          <it.icon className="mb-1 h-5 w-5" style={{ color: "var(--brand)" }} />
          <div className="monitor-kpi-label">{it.label}</div>
          <div className="monitor-kpi-value">{it.value}</div>
          <div className="text-xs leading-tight" style={{ color: "var(--text-faint)" }}>{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function statusColor(level: string) {
  if (level === "warn") return "var(--warn)";
  if (level === "critical") return "var(--critical)";
  if (level === "idle") return "var(--text-faint)";
  return "var(--good)";
}

function ClusterPanel({ c, delay }: { c: Cluster; delay: number }) {
  const { language, t } = useLocale();
  const accent = c.accent || "var(--brand)";
  return (
    <motion.section
      id={`cluster-${c.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="panel overflow-hidden"
    >
      {/* head */}
      <div className="flex flex-wrap items-center gap-3 p-5 md:p-6" style={{ borderBottom: "1px solid var(--border)" }}>
        <span
          className="rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide tabular-nums"
          style={{ color: accent, background: accent + "1f", fontFamily: "var(--font-mono)" }}
        >
          {c.id}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold not-italic sm:text-2xl">
            {localizeSnapshotText(c.name, language)} <span className="text-sm font-normal tabular-nums" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>· {localizeSnapshotText(c.subtitle, language)}</span>
          </h2>
          <div className="mt-0.5 text-sm" style={{ color: "var(--text-dim)" }}>{localizeSnapshotText(c.stack, language)}</div>
        </div>
        <span className="flex-1" />
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
          style={{ color: statusColor(c.statusLevel), background: `color-mix(in srgb, ${statusColor(c.statusLevel)} 14%, transparent)` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: statusColor(c.statusLevel) }} /> {localizeSnapshotText(c.status, language)}
        </span>
      </div>

      <div className="p-5 md:p-6">
        {/* quick facts */}
        <div className="mb-7 flex flex-wrap gap-x-9 gap-y-3">
          {c.quick.map((q) => (
            <div key={q.l} className="flex flex-col">
              <span className="text-xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{q.v}</span>
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>{localizeSnapshotText(q.l, language)}</span>
            </div>
          ))}
        </div>

        {/* nodes */}
        <div className="cluster-node-grid">
          {c.nodes.map((n) => (
            <div
              key={n.name}
              className="cluster-node-card rounded-xl"
              style={{
                background: "var(--surface-2)",
                outline: n.highlight ? `1.5px solid ${accent}66` : `1px solid var(--border)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{n.name}</div>
                  {n.role && <div className="text-xs" style={{ color: "var(--text-faint)" }}>{localizeSnapshotText(n.role, language)}</div>}
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: n.status === "up" ? "var(--good)" : "var(--text-faint)",
                    boxShadow: n.status === "up" ? "0 0 0 3px var(--good-soft)" : "none",
                  }}
                />
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <Row k="CPU" v={n.cpu} />
                <Row k="RAM" v={n.ram} />
                {n.gpu && (
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: "var(--text-faint)" }}>GPU</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-bold tabular-nums"
                      style={
                        n.gpuLevel === "pending"
                          ? { color: "var(--warn)", background: "var(--warn-soft)", fontFamily: "var(--font-mono)" }
                          : { color: accent, background: accent + "1f", fontFamily: "var(--font-mono)" }
                      }
                    >
                      {localizeSnapshotText(n.gpu, language)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* meters */}
        {c.meters?.length > 0 && (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.meters.map((m) => {
              const color = m.level === "good" ? "var(--good)" : accent;
              return (
                <div key={m.label}>
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span style={{ color: "var(--text-dim)" }}>{localizeSnapshotText(m.label, language)}</span>
                    <span className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{m.value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details className="cluster-details">
          <summary>{t("服務與虛擬機明細", "Services & VM Details")}</summary>
        {/* services */}
        {c.services && c.services.length > 0 && (
          <>
            <Divider label={t("運行中服務", "Running Services")} />
            <div className="flex flex-wrap gap-2">
              {c.services.map((sv) => (
                <span key={sv} className="chip inline-flex items-center gap-2 px-3.5 py-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--good)" }} /> {localizeSnapshotText(sv, language)}
                </span>
              ))}
            </div>
          </>
        )}

        {/* vms */}
        {c.vms && c.vms.length > 0 && (
          <>
            <Divider label={t("承載中的服務 / 工作負載", "Hosted Services / Workloads")} />
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
                    <th className="px-4 py-3">{t("虛擬機", "Virtual Machine")}</th>
                    <th className="px-4 py-3">{t("用途", "Purpose")}</th>
                    <th className="px-4 py-3">{t("節點", "Node")}</th>
                    <th className="px-4 py-3">{t("狀態", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.vms.map((vm, i) => (
                    <tr key={vm.name} style={i < c.vms!.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}>
                      <td className="px-4 py-3 font-medium tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{vm.name}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-dim)" }}>{localizeSnapshotText(vm.use, language)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{vm.node}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={
                            vm.state === "running"
                              ? { color: "var(--good)", background: "var(--good-soft)" }
                              : { color: "var(--text-faint)", background: "var(--surface-2)" }
                          }
                        >
                          {vm.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </details>
      </div>
    </motion.section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--text-faint)" }}>{k}</span>
      <span className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{v}</span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-3.5 mt-7 flex items-center gap-3">
      <span className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}
