import fs from "node:fs";
import path from "node:path";
import { freshGpuTelemetry, sanitizeGpuTelemetry, type GpuTelemetry } from "./gpu-telemetry";

// This contract and its URLs stay on the server. Only normalized measurements
// are returned by snapshot(); neither target labels nor network details escape.
export type ExporterTarget = {
  machineId: string; capacityHostId: string; kind: "node" | "nvidia" | "dcgm" | "gpu-json"; url: string;
  transport?: "pull" | "push";
};
type Sample = { name: string; labels: Record<string, string>; value: number; timestamp: number | null };
type NodeSample = {
  sampledAt: string; cpuPercent: number | null; ramUsed: number | null; ramTotal: number | null;
};
type CollectedGpu = GpuTelemetry & { uuid: string | null };
type State = {
  target: ExporterTarget; checkedAt: string; lastSeen: string | null; reachable: boolean;
  healthy: boolean; node: NodeSample | null; gpus: CollectedGpu[];
  sharedMemory?: { used: number | null; total: number | null; sampledAt: string } | null;
};
export type HostTelemetry = {
  monitored: boolean; telemetryStatus: "healthy" | "collector-error" | "awaiting-data";
  sampledAt: string | null; checkedAt: string | null; lastSeen: string | null;
  systemSampledAt: string | null;
  cpuPercent: number | null; ramUsed: number | null; ramTotal: number | null;
  sharedMemory: { used: number | null; total: number | null; sampledAt: string } | null;
  gpus: GpuTelemetry[];
};
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const fresh = (stamp: string | null, now: number) => stamp != null && now - Date.parse(stamp) >= -30_000 && now - Date.parse(stamp) < 120_000;

export function parseMetrics(body: string): Sample[] {
  const samples: Sample[] = [];
  for (const line of body.split(/\r?\n/).slice(0, 100_000)) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([^\s]+)(?:\s+(-?\d+))?\s*$/);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const label of (match[2] ?? "").matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g)) {
      labels[label[1]] = label[2].replace(/\\([\\"n])/g, (_, char) => char === "n" ? "\n" : char);
    }
    const value = Number(match[3]);
    if (!Number.isFinite(value)) continue; // N/A, NaN, Inf and DCGM sentinel values aren't zero.
    samples.push({ name: match[1], labels, value, timestamp: match[4] ? Number(match[4]) : null });
  }
  return samples;
}

export function loadExporterTargets(filename = path.join(process.cwd(), "exporter-targets.default.json")): ExporterTarget[] {
  if (!fs.existsSync(filename)) return [];
  try {
    const config = JSON.parse(fs.readFileSync(filename, "utf8"));
    const seen = new Set<string>();
    return (Array.isArray(config.targets) ? config.targets : []).slice(0, 256).flatMap((raw: any) => {
      if (!/^inv-\d+$/.test(raw?.machineId ?? "") || !/^inv-\d+$/.test(raw?.capacityHostId ?? raw?.machineId ?? "")
        || !["node", "nvidia", "dcgm", "gpu-json"].includes(raw?.kind) || typeof raw?.url !== "string") return [];
      let url: URL;
      try { url = new URL(raw.url); } catch { return []; }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return [];
      if (raw.transport != null && !["pull", "push"].includes(raw.transport)) return [];
      if (raw.transport === "push" && !["node", "nvidia"].includes(raw.kind)) return [];
      const target: ExporterTarget = { machineId: raw.machineId, capacityHostId: raw.capacityHostId ?? raw.machineId, kind: raw.kind, url: url.href, transport: raw.transport ?? "pull" };
      const key = `${target.kind}|${target.machineId}|${target.url}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [target];
    });
  } catch { console.error("Exporter target configuration unavailable"); return []; }
}

function gpuSamples(samples: Sample[], kind: "nvidia" | "dcgm", now: number): { healthy: boolean; gpus: CollectedGpu[] } {
  const pick = (name: string, labels?: Record<string, string>) => samples.find(sample => sample.name === name
    && (!labels || (labels.uuid ? sample.labels.uuid === labels.uuid : String(sample.labels.index ?? sample.labels.gpu ?? "0") === String(labels.index ?? labels.gpu ?? "0"))));
  const success = pick("nvidia_smi_last_collect_success");
  const exit = pick("nvidia_smi_command_exit_code");
  const healthy = kind === "dcgm" || ((success?.value ?? 1) === 1 && (exit?.value ?? 0) === 0);
  const globalTime = pick("nvidia_smi_last_collect_success_timestamp_seconds")?.value
    ?? pick("nvidia_smi_last_success_timestamp_seconds")?.value;
  const infos = kind === "nvidia" ? samples.filter(s => s.name === "nvidia_smi_gpu_info")
    : samples.filter(s => s.name === "DCGM_FI_DEV_FB_TOTAL" && !s.labels.GPU_I_PROFILE && !s.labels.GPU_I_ID);
  const seen = new Set<string>();
  const gpus = infos.flatMap(info => {
    const labels = info.labels;
    const index = String(labels.index ?? labels.gpu ?? "0");
    if (!/^\d+$/.test(index)) return [];
    const uuid = labels.uuid ?? labels.UUID ?? null;
    const identity = uuid || index;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const value = (name: string) => {
      const n = finite(pick(name, kind === "dcgm" ? { ...labels, uuid: undefined } : labels)?.value);
      return kind === "dcgm" && n != null && n >= 1e15 ? null : n;
    };
    const stamp = value("nvidia_smi_sample_timestamp_seconds") ?? globalTime;
    const sampledAt = stamp != null && stamp > 0 ? new Date(stamp * 1000).toISOString()
      : healthy ? new Date(info.timestamp ?? now).toISOString() : null;
    const migEnabled = value("nvidia_smi_mig_enabled") === 1 || value("DCGM_FI_DEV_MIG_MODE") === 1;
    const util = kind === "dcgm" ? value("DCGM_FI_DEV_GPU_UTIL") : value("nvidia_smi_utilization_gpu_ratio");
    const metric = (nvidia: string, dcgm: string, scale = 1) => kind === "dcgm" ? ((value(dcgm) ?? NaN) * scale) : value(nvidia);
    const gpu = sanitizeGpuTelemetry({ index, sampledAt, migEnabled,
      util: healthy && util != null ? util / (kind === "dcgm" ? 100 : 1) : null,
      utilAvailable: kind === "dcgm" ? !migEnabled : value("nvidia_smi_utilization_available") !== 0 && util != null,
      memUsed: healthy ? metric("nvidia_smi_memory_used_bytes", "DCGM_FI_DEV_FB_USED", 1024 ** 2) : null,
      memTotal: metric("nvidia_smi_memory_total_bytes", "DCGM_FI_DEV_FB_TOTAL", 1024 ** 2),
      temp: healthy ? metric("nvidia_smi_temperature_gpu", "DCGM_FI_DEV_GPU_TEMP") : null,
      power: healthy ? metric("nvidia_smi_power_draw_watts", "DCGM_FI_DEV_POWER_USAGE") : null,
      powerLimit: metric("nvidia_smi_power_limit_watts", "DCGM_FI_DEV_POWER_MGMT_LIMIT"),
    });
    return gpu ? [{ ...gpu, uuid }] : [];
  });
  return { healthy: healthy && gpus.length > 0, gpus };
}

export class ExporterCollector {
  private states = new Map<ExporterTarget, State>();
  private counters = new Map<ExporterTarget, Map<string, number>>();
  private refreshing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private targets: ExporterTarget[], private fetcher: typeof fetch = fetch, private concurrency = 6) {}
  get configured() { return this.targets.length > 0; }
  start() {
    if (!this.configured || this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 5000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const pullTargets = this.targets.filter(target => target.transport !== "push");
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(this.concurrency, pullTargets.length) }, async () => {
        while (next < pullTargets.length) await this.collect(pullTargets[next++]);
      }));
    } finally { this.refreshing = false; }
  }
  ingestPush(machineId: string, kind: "node" | "nvidia", body: string, sampledAt?: string): boolean {
    const target = this.targets.find(target => target.transport === "push" && target.machineId === machineId && target.kind === kind);
    if (!target || typeof body !== "string" || !body.trim() || Buffer.byteLength(body, "utf8") > 2 * 1024 ** 2) return false;
    const timestamp = sampledAt ? Date.parse(sampledAt) : Date.now();
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 30_000) return false;
    try { this.consume(target, body, new Date().toISOString(), timestamp); return true; }
    catch { return false; }
  }
  private async collect(target: ExporterTarget) {
    const previous = this.states.get(target);
    const checkedAt = new Date().toISOString();
    try {
      const response = await this.fetcher(target.url, { signal: AbortSignal.timeout(4000), redirect: "error", cache: "no-store" });
      if (!response.ok) throw new Error("Exporter unavailable");
      if (Number(response.headers.get("content-length") ?? 0) > 4 * 1024 ** 2) throw new Error("Exporter response too large");
      const body = await response.text();
      if (body.length > 4 * 1024 ** 2) throw new Error("Exporter response too large");
      this.consume(target, body, checkedAt);
    } catch {
      this.states.set(target, { target, checkedAt, lastSeen: previous?.lastSeen ?? null, reachable: false, healthy: false,
        node: previous?.node ?? null, gpus: previous?.gpus ?? [], sharedMemory: previous?.sharedMemory ?? null });
    }
  }
  private consume(target: ExporterTarget, body: string, checkedAt: string, now = Date.now()) {
    const previous = this.states.get(target);
      const samples = parseMetrics(body);
      let node: NodeSample | null = null;
      let gpus: CollectedGpu[] = [];
      let sharedMemory: State["sharedMemory"] = null;
      let healthy = false;
      if (target.kind === "node") {
        const cpus = samples.filter(s => s.name === "node_cpu_seconds_total" && !["guest", "guest_nice"].includes(s.labels.mode));
        const before = this.counters.get(target);
        const counters = new Map(cpus.map(s => [`${s.labels.cpu}|${s.labels.mode}`, s.value]));
        let total = 0, idle = 0, reset = false;
        if (before) for (const sample of cpus) {
          const old = before.get(`${sample.labels.cpu}|${sample.labels.mode}`);
          if (old == null) { reset = true; continue; }
          const delta = sample.value - old;
          if (delta < 0) { reset = true; continue; }
          total += delta;
          if (sample.labels.mode === "idle") idle += delta;
        }
        this.counters.set(target, counters);
        const memory = finite(samples.find(s => s.name === "node_memory_MemTotal_bytes")?.value);
        const available = finite(samples.find(s => s.name === "node_memory_MemAvailable_bytes")?.value);
        healthy = cpus.length > 0 || memory != null;
        if (healthy) node = { sampledAt: new Date(now).toISOString(), cpuPercent: before && !reset && total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : null,
          ramTotal: memory, ramUsed: memory != null && available != null ? Math.max(0, memory - available) : null };
      } else if (target.kind === "gpu-json") {
        const payload = JSON.parse(body);
        healthy = payload.collectionSuccess !== false && payload.online !== false;
        const stamp = payload.lastSuccessAt ?? payload.sampledAt ?? payload.updatedAt;
        gpus = (Array.isArray(payload.gpus) ? payload.gpus : []).slice(0, 32).flatMap((raw: any) => {
          const gpu = sanitizeGpuTelemetry(raw, stamp);
          return gpu ? [{ ...gpu, uuid: typeof raw.uuid === "string" ? raw.uuid : null }] : [];
        });
        healthy = healthy && gpus.length > 0;
        if (payload.sharedMemory && Number.isFinite(Date.parse(stamp))) sharedMemory = {
          used: finite(payload.sharedMemory.used), total: finite(payload.sharedMemory.total), sampledAt: new Date(stamp).toISOString(),
        };
        if (payload.system && Number.isFinite(Date.parse(stamp))) {
          const total = finite(payload.system.memTotal), available = finite(payload.system.memAvailable);
          const cpu = finite(payload.system.cpuUtil);
          node = { sampledAt: new Date(stamp).toISOString(), cpuPercent: cpu != null && cpu <= 100 ? cpu : null,
            ramTotal: total, ramUsed: total != null && available != null ? Math.max(0, total - available) : null };
        }
      } else ({ healthy, gpus } = gpuSamples(samples, target.kind, now));
      this.states.set(target, { target, checkedAt, lastSeen: healthy ? new Date(now).toISOString() : previous?.lastSeen ?? null,
        reachable: true, healthy, node: node ?? previous?.node ?? null, gpus: gpus.length ? gpus : previous?.gpus ?? [],
        sharedMemory: sharedMemory ?? previous?.sharedMemory ?? null });
  }
  snapshot(machineId: string, now = Date.now()): HostTelemetry | null {
    const matchingTargets = this.targets.filter(target => target.kind === "node" ? target.machineId === machineId : target.capacityHostId === machineId);
    if (!matchingTargets.length) return null;
    const states = matchingTargets.flatMap(target => this.states.has(target) ? [this.states.get(target)!] : []);
    const nodes = states.filter(s => s.node && s.target.machineId === machineId).sort((a, b) => Date.parse(b.node!.sampledAt) - Date.parse(a.node!.sampledAt));
    const node = nodes[0]?.node;
    const nodeFresh = !!node && fresh(node.sampledAt, now);
    const seen = new Set<string>();
    const gpus = states.filter(s => s.target.kind !== "node").flatMap(state => state.gpus.map(gpu => ({ gpu, healthy: state.healthy })))
      .sort((a, b) => Date.parse(b.gpu.sampledAt ?? "") - Date.parse(a.gpu.sampledAt ?? ""))
      .flatMap(({ gpu, healthy }) => {
        const key = gpu.uuid ?? `index-${gpu.index}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const { uuid, ...measurement } = gpu;
        const current = freshGpuTelemetry(measurement, now);
        return [{ ...current, ...(healthy ? {} : { util: null, utilUnavailableReason: current.migEnabled ? "mig-enabled" : "collector-error" }) }];
      });
    const sampledAt = [node?.sampledAt, ...gpus.map(g => g.sampledAt)].filter(Boolean).sort().at(-1) ?? null;
    const healthy = states.length === matchingTargets.length && states.every(s => s.healthy &&
      (s.target.kind === "node" ? !!s.node && fresh(s.node.sampledAt, now) : s.gpus.length > 0 && s.gpus.every(gpu => fresh(gpu.sampledAt, now))));
    const shared = states.flatMap(s => s.sharedMemory ? [s.sharedMemory] : []).sort((a, b) => Date.parse(b.sampledAt) - Date.parse(a.sampledAt))[0];
    return { monitored: true, telemetryStatus: healthy ? "healthy" : states.length ? "collector-error" : "awaiting-data", sampledAt,
      systemSampledAt: node?.sampledAt ?? null,
      checkedAt: states.map(s => s.checkedAt).sort().at(-1) ?? null,
      lastSeen: states.map(s => s.lastSeen).filter(Boolean).sort().at(-1) ?? null,
      cpuPercent: nodeFresh ? node!.cpuPercent : null, ramUsed: nodeFresh ? node!.ramUsed : null, ramTotal: node?.ramTotal ?? null,
      sharedMemory: shared ? { ...shared, used: fresh(shared.sampledAt, now) ? shared.used : null } : null, gpus };
  }
}
