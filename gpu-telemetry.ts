// Public-safe contract for an optional, read-only GPU telemetry provider.
export type MigSlice = {
  giId: number; ciId: number; profile: string; sm: number | null;
  memUsed: number | null; memTotal: number | null;
};
export type GpuTelemetry = {
  index: string; sampledAt: string | null; migEnabled: boolean;
  util: number | null; utilAvailable: boolean; utilUnavailableReason: string | null;
  memUsed: number | null; memTotal: number | null; temp: number | null;
  power: number | null; powerLimit: number | null;
  migProfile: string | null; migSlices: MigSlice[];
};

const number = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const text = (v: unknown): string | null => typeof v === "string" && v.length <= 120 && !/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(v) ? v : null;
export function sanitizeGpuTelemetry(raw: any, fallbackTime?: unknown): GpuTelemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const stamp = Date.parse(raw.sampledAt ?? fallbackTime ?? "");
  const sampledAt = Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
  const migEnabled = raw.migEnabled === true;
  const util = number(raw.util);
  const migSlices = (Array.isArray(raw.migSlices) ? raw.migSlices : []).slice(0, 128).flatMap((s: any) => {
    if (!s || !Number.isInteger(s.giId) || s.giId < 0 || !Number.isInteger(s.ciId) || s.ciId < 0 || !text(s.profile)) return [];
    return [{ giId: s.giId, ciId: s.ciId, profile: text(s.profile)!, sm: number(s.sm), memUsed: number(s.memUsed), memTotal: number(s.memTotal) }];
  });
  return {
    index: text(String(raw.index ?? "0")) ?? "0", sampledAt, migEnabled,
    util: migEnabled || util == null || util > 1 ? null : util,
    utilAvailable: !migEnabled && raw.utilAvailable !== false,
    utilUnavailableReason: migEnabled ? "mig-enabled" : raw.utilAvailable === false ? "unsupported" : null,
    memUsed: number(raw.memUsed), memTotal: number(raw.memTotal), temp: number(raw.temp),
    power: number(raw.power), powerLimit: number(raw.powerLimit),
    migProfile: text(raw.migProfile), migSlices,
  };
}
export function freshGpuTelemetry(gpu: GpuTelemetry, now = Date.now()): GpuTelemetry {
  const age = gpu.sampledAt ? now - Date.parse(gpu.sampledAt) : Infinity;
  if (age >= -30_000 && age < 120_000) return gpu;
  // Retain device capabilities; never retain stale measurements as current.
  return { ...gpu, util: null, memUsed: null, temp: null, power: null,
    migSlices: gpu.migSlices.map(slice => ({ ...slice, memUsed: null })),
    utilUnavailableReason: gpu.migEnabled ? "mig-enabled" : "stale" };
}
