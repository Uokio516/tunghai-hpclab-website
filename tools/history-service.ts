import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// One writer with a PVC; both website replicas read the same history through its Service.
const source = process.env.HISTORY_SOURCE_URL ?? "http://hpc-lab-service/api/gpus";
const dbPath = process.env.HISTORY_DB_PATH ?? "./data/monitor-history.sqlite";
const port = Number(process.env.PORT ?? 3001);
const retentionDays = 30;

type Gpu = { util?: number | null; utilAvailable?: boolean; sampledAt?: string | null; class?: string };
type Host = { id: string; online?: boolean | null; cpuPercent?: number | null; ramUsed?: number | null; ramTotal?: number | null; systemSampledAt?: string | null; gpus?: Gpu[] };
const fresh = (stamp: string | null | undefined, now: number) => !!stamp && Number.isFinite(Date.parse(stamp)) && now - Date.parse(stamp) >= -30_000 && now - Date.parse(stamp) < 120_000;
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

const db = await open({ filename: dbPath, driver: sqlite3.Database });
await db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS samples (
  machine_id TEXT NOT NULL, minute INTEGER NOT NULL, online INTEGER,
  gpu_util REAL, cpu_percent REAL, ram_percent REAL,
  PRIMARY KEY (machine_id, minute)
);
CREATE INDEX IF NOT EXISTS samples_minute ON samples(minute);`);

let lastCollectedAt: string | null = null;
let collecting = false;
async function collect() {
  if (collecting) return;
  collecting = true;
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(20_000), headers: { "Cache-Control": "no-store" } });
    if (!response.ok) throw new Error(`source ${response.status}`);
    const payload = await response.json() as { machines?: Host[]; inventory?: { machines?: Host[] } };
    const now = Date.now();
    const minute = Math.floor(now / 60_000) * 60_000;
    const rows = [...(payload.machines ?? []), ...(payload.inventory?.machines ?? [])];
    await db.exec("BEGIN IMMEDIATE");
    try {
      for (const machine of rows) {
        if (!/^[-a-zA-Z0-9_]{1,80}$/.test(machine.id)) continue;
        const values = (machine.gpus ?? []).filter((gpu) => gpu.class !== "display-only" && gpu.utilAvailable !== false && fresh(gpu.sampledAt, now)).map((gpu) => numberOrNull(gpu.util)).filter((value): value is number => value != null);
        const gpuUtil = values.length ? values.reduce((a, b) => a + b, 0) / values.length * 100 : null;
        const cpu = fresh(machine.systemSampledAt, now) ? numberOrNull(machine.cpuPercent) : null;
        const used = fresh(machine.systemSampledAt, now) ? numberOrNull(machine.ramUsed) : null;
        const total = numberOrNull(machine.ramTotal);
        const ram = used != null && total != null && total > 0 ? used / total * 100 : null;
        await db.run("INSERT OR REPLACE INTO samples (machine_id, minute, online, gpu_util, cpu_percent, ram_percent) VALUES (?, ?, ?, ?, ?, ?)", machine.id, minute, machine.online == null ? null : Number(machine.online), gpuUtil, cpu, ram);
      }
      await db.run("DELETE FROM samples WHERE minute < ?", now - retentionDays * 86_400_000);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    lastCollectedAt = new Date().toISOString();
  } catch (error) {
    console.error("History collection failed:", error instanceof Error ? error.message : "unknown error");
  } finally { collecting = false; }
}

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true, lastCollectedAt }));
app.get("/history", async (req, res) => {
  const machineId = String(req.query.machineId ?? "");
  const hours = Number(req.query.hours ?? 24);
  if (!/^[-a-zA-Z0-9_]{1,80}$/.test(machineId) || ![1, 6, 24, 168, 720].includes(hours)) return res.status(400).json({ error: "Invalid query" });
  const points = await db.all("SELECT minute AS at, online, gpu_util AS gpuUtil, cpu_percent AS cpuPercent, ram_percent AS ramPercent FROM samples WHERE machine_id = ? AND minute >= ? ORDER BY minute ASC", machineId, Date.now() - hours * 3_600_000);
  res.setHeader("Cache-Control", "no-store");
  res.json({ machineId, hours, startedAt: points[0]?.at ?? null, points });
});
app.listen(port, "0.0.0.0", () => console.log(`History service listening on ${port}`));
void collect();
setInterval(() => void collect(), 60_000);
