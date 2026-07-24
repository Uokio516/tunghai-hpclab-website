import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// No hardcoded fallback: the admin password comes only from the
// ADMIN_PASSWORD env var (see .env.example). If it's unset, admin auth
// fails closed rather than falling back to a known default.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAdminAuth(req: express.Request, res: express.Response): boolean {
  const pwd = (req.headers["x-admin-password"] as string) || (req.query.pwd as string);
  if (!ADMIN_PASSWORD || pwd !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  const dbPath =
    process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "data", "database.sqlite")
      : "./database.sqlite";

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Submit a contact message (public)
  app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      await db.run(
        "INSERT INTO messages (name, email, message) VALUES (?, ?, ?)",
        [name, email, message]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  // List all messages (admin, password via X-Admin-Password header)
  app.get("/api/messages", async (req, res) => {
    if (!checkAdminAuth(req, res)) return;
    const messages = await db.all(
      "SELECT * FROM messages ORDER BY created_at DESC"
    );
    res.json(messages);
  });

  // Update a message (admin)
  app.put("/api/messages/:id", async (req, res) => {
    if (!checkAdminAuth(req, res)) return;
    const { name, email, message } = req.body;
    try {
      await db.run(
        "UPDATE messages SET name = ?, email = ?, message = ? WHERE id = ?",
        [name, email, message, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // Delete a message (admin)
  app.delete("/api/messages/:id", async (req, res) => {
    if (!checkAdminAuth(req, res)) return;
    try {
      await db.run("DELETE FROM messages WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Cluster infrastructure status (public, read-only snapshot).
  // NOTE: this endpoint intentionally holds NO cluster credentials. It serves a JSON
  // snapshot that an out-of-band collector can refresh by writing data/cluster-status.json.
  // Falls back to the bundled cluster-status.default.json when no live snapshot exists.
  app.get("/api/cluster-status", (_req, res) => {
    const candidates = [
      path.join(process.cwd(), "data", "cluster-status.json"),
      path.join(process.cwd(), "cluster-status.default.json"),
    ];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          return res.type("application/json").send(fs.readFileSync(file, "utf-8"));
        }
      } catch (error) {
        console.error("cluster-status read error:", error);
      }
    }
    res.status(404).json({ error: "Cluster status not available" });
  });

  // Library GPU fleet live status (public). Queries the lab Prometheus server-side and
  // returns a per-machine / per-GPU snapshot. NO credentials are exposed to the browser;
  // Prometheus itself is not publicly reachable. The Prometheus location comes only from
  // the PROMETHEUS_URL env var (see .env.example) — no internal address is baked in.
  const PROM = process.env.PROMETHEUS_URL;
  app.get("/api/gpus", async (_req, res) => {
    if (!PROM) {
      return res.status(503).json({ error: "GPU monitoring not configured" });
    }
    const promBase: string = PROM;
    const q = async (expr: string) => {
      const r = await fetch(`${promBase}/api/v1/query?query=${encodeURIComponent(expr)}`);
      const j: any = await r.json();
      return (j?.data?.result ?? []) as any[];
    };
    const gkey = (m: any) => `${m.instance}|${m.uuid ?? m.index ?? ""}`;
    const pick = (arr: any[], k: string) => {
      const f = arr.find((x) => gkey(x.metric) === k);
      return f ? Number(f.value[1]) : null;
    };
    try {
      const [
        info, up, util, utilPeak1h, collectSuccess, commandExitCode,
        memUsed, memTotal, temp, power, powerLimit, fan,
        cpuBusy, ramTotal, ramAvail,
      ] = await Promise.all([
        q("nvidia_smi_gpu_info"),
        q('up{job="gpu-nodes"}'),
        // A one-minute average is more representative than a single scrape
        // that can land between GPU kernels and misleadingly flash 0%.
        q("avg_over_time(nvidia_smi_utilization_gpu_ratio[1m])"),
        // Keep a recent peak beside the live value so a currently idle
        // workstation does not look like fabricated/static monitoring.
        q("max_over_time(nvidia_smi_utilization_gpu_ratio[1h])"),
        q("nvidia_smi_last_collect_success"),
        q("nvidia_smi_command_exit_code"),
        q("nvidia_smi_memory_used_bytes"),
        q("nvidia_smi_memory_total_bytes"),
        q("nvidia_smi_temperature_gpu"),
        q("nvidia_smi_power_draw_watts"),
        q("nvidia_smi_power_limit_watts"),
        q("nvidia_smi_fan_speed_ratio"),
        // system metrics from node_exporter (joined by IP below)
        q('100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        q("node_memory_MemTotal_bytes"),
        q("node_memory_MemAvailable_bytes"),
      ]);

      // node_exporter runs on a different port, so join on IP (strip :port)
      const byIp = (arr: any[]) => {
        const out: Record<string, number> = {};
        arr.forEach((x) => {
          const ip = String(x.metric.instance || "").split(":")[0];
          if (ip) out[ip] = Number(x.value[1]);
        });
        return out;
      };
      const cpuByIp = byIp(cpuBusy);
      const ramTotalByIp = byIp(ramTotal);
      const ramAvailByIp = byIp(ramAvail);

      const upBy: Record<string, number> = {};
      up.forEach((u) => (upBy[u.metric.instance] = Number(u.value[1])));
      const byInstance = (arr: any[]) => {
        const result: Record<string, number> = {};
        arr.forEach((item) => {
          if (item.metric.instance) result[item.metric.instance] = Number(item.value[1]);
        });
        return result;
      };
      const collectSuccessBy = byInstance(collectSuccess);
      const commandExitCodeBy = byInstance(commandExitCode);

      const machines: Record<string, any> = {};
      info.forEach((g) => {
        const m = g.metric;
        const inst = m.instance as string;
        if (!machines[inst]) {
          const ip = (m.hostname as string) || inst.split(":")[0];
          const ramTotalB = ramTotalByIp[ip];
          const ramAvailB = ramAvailByIp[ip];
          machines[inst] = {
            instance: inst,
            ip, // stripped before sending to the client, see publicList below
            owner: m.owner || "",
            location: m.location || "",
            online: (upBy[inst] ?? 0) === 1,
            cpuPercent: cpuByIp[ip] != null ? Math.max(0, Math.min(100, cpuByIp[ip])) : null,
            ramUsed: ramTotalB != null && ramAvailB != null ? ramTotalB - ramAvailB : null,
            ramTotal: ramTotalB ?? null,
            gpus: [],
          };
        }
        const k = gkey(m);
        machines[inst].gpus.push({
          index: m.index,
          name: m.name,
          model: m.gpu,
          driver: m.driver_version,
          util: pick(util, k),
          utilPeak1h: pick(utilPeak1h, k),
          memUsed: pick(memUsed, k),
          memTotal: pick(memTotal, k),
          temp: pick(temp, k),
          power: pick(power, k),
          powerLimit: pick(powerLimit, k),
          fan: pick(fan, k),
        });
      });
      // include targets that are down (no gpu_info) so they show as offline
      Object.keys(upBy).forEach((inst) => {
        if (!machines[inst]) {
          machines[inst] = {
            instance: inst,
            ip: inst.split(":")[0],
            owner: "",
            location: "",
            online: upBy[inst] === 1,
            telemetryStatus: collectSuccessBy[inst] === 0 ? "collector-error" : "awaiting-data",
            telemetryCode: commandExitCodeBy[inst] ?? null,
            gpus: [],
          };
        }
      });

      const list = Object.values(machines).sort((a: any, b: any) =>
        a.instance.localeCompare(b.instance, undefined, { numeric: true })
      );
      const online = list.filter((m: any) => m.online);
      const gpuCount = online.reduce((n: number, m: any) => n + m.gpus.length, 0);
      const busy = online.reduce(
        (n: number, m: any) =>
          n + m.gpus.filter((g: any) => (g.util ?? 0) >= 0.2).length,
        0
      );
      // Public-safe view: DO NOT expose machine IPs / instances to the browser.
      const publicList = list.map((m: any, i: number) => ({
        id: `gpu-${i + 1}`,
        label: m.owner || `機器 ${i + 1}`,
        location: m.location || "",
        online: m.online,
        telemetryStatus: m.gpus.length > 0 ? "healthy" : (m.telemetryStatus || "awaiting-data"),
        telemetryCode: m.gpus.length > 0 ? null : (m.telemetryCode ?? null),
        cpuPercent: m.cpuPercent,
        ramUsed: m.ramUsed,
        ramTotal: m.ramTotal,
        gpus: m.gpus,
      }));
      res.json({
        updatedAt: new Date().toISOString(),
        source: "prometheus",
        summary: {
          machinesTotal: list.length,
          machinesOnline: online.length,
          gpusOnline: gpuCount,
          gpusBusy: busy,
        },
        machines: publicList,
      });
    } catch (error) {
      console.error("gpus query error:", error);
      res.status(502).json({ error: "GPU monitoring temporarily unavailable" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
