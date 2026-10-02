import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import net from "net";

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

// Prometheus labels the card "RTX4070TiS" while the inventory spells it
// "RTX 4070 Ti SUPER". Fold both spellings onto one name so a card is not counted
// twice under two labels.
function canonicalGpu(raw: string): string {
  const compact = String(raw).toUpperCase().replace(/[\s_-]/g, "");
  const m = compact.match(/^(RTX|GTX)(\d{3,4})(TI)?(S|SUPER)?$/);
  if (m) {
    return [m[1] === "RTX" ? "RTX" : "GTX", m[2], m[3] ? "Ti" : "", m[4] ? "SUPER" : ""]
      .filter(Boolean)
      .join(" ");
  }
  return String(raw).trim();
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
  // Reads an out-of-band snapshot: the collector-written copy under data/ when it
  // exists, otherwise the copy bundled into the image. data/ is the mounted hostPath,
  // so a snapshot can be refreshed without rebuilding or restarting anything.
  // The collector copy wins only while it is actually fresher. A collector run that
  // stops happening used to leave a stale file silently masking a newer snapshot
  // shipped in the image, which is how /api/cluster-status went on serving July data
  // through a deploy that had already corrected it.
  const readSnapshot = (name: string): string | null => {
    const read = (file: string): { body: string; at: number } | null => {
      try {
        if (!fs.existsSync(file)) return null;
        const body = fs.readFileSync(file, "utf-8");
        const stamp = Date.parse(JSON.parse(body)?.updatedAt ?? "");
        return { body, at: Number.isNaN(stamp) ? 0 : stamp };
      } catch (error) {
        console.error(`${name} read error (${path.basename(file)}):`, error);
        return null;
      }
    };
    const live = read(path.join(process.cwd(), "data", `${name}.json`));
    const bundled = read(path.join(process.cwd(), `${name}.default.json`));
    if (live && bundled) return live.at >= bundled.at ? live.body : bundled.body;
    return (live ?? bundled)?.body ?? null;
  };

  app.get("/api/cluster-status", (_req, res) => {
    const body = readSnapshot("cluster-status");
    if (body) return res.type("application/json").send(body);
    res.status(404).json({ error: "Cluster status not available" });
  });

  // Hand-kept hardware inventory (built from the lab's device spreadsheet by
  // tools/build-inventory.py and probed by tools/probe-inventory.py). It covers the
  // machines that have no Prometheus exporter, so the site can show the lab's whole
  // capacity rather than only the monitored subset.
  type InventoryGpu = { model: string; vramGB: number | null; class: string; passthrough: boolean };
  type InventoryMachine = {
    id: string; ip: string | null; label: string; owner: string; type: string; os: string | null;
    location: string; group: string; groupName: string;
    cpu: string | null; cpuThreads: number | null; ramGB: number | null;
    gpus: InventoryGpu[]; virtual: boolean; reachable: boolean; ports: number[];
    include: boolean; excludeReason: string | null; countsForCapacity: boolean; edge: boolean;
  };
  type Inventory = {
    updatedAt: string; probedAt: string; source: string;
    totals: Record<string, number>;
    gpuModels: { model: string; count: number; vramGB: number | null; class: string }[];
    machines: InventoryMachine[];
  };
  const loadInventory = (): Inventory | null => {
    const body = readSnapshot("lab-inventory");
    if (!body) return null;
    try {
      return JSON.parse(body) as Inventory;
    } catch (error) {
      console.error("lab-inventory parse error:", error);
      return null;
    }
  };
  // Machines that answer nothing have been physically relocated; they are kept in the
  // file for the next sync but never rendered.
  const shownInventory = (inv: Inventory) => inv.machines.filter((m) => m.include);

  // Live reachability for the machines that have no exporter. Without this the page
  // would be a frozen spec sheet; the lab wants it to read as monitoring, so each
  // listed machine is re-probed on a timer and reports real up/down.
  //
  // A plain TCP connect, nothing sent, nothing logged into — the cheapest check that
  // still distinguishes "powered on" from "not answering". ICMP would need a raw
  // socket and root, which this container deliberately does not have.
  const PROBE_INTERVAL_MS = 60_000;
  const PROBE_TIMEOUT_MS = 1_500;
  const PROBE_CONCURRENCY = 16;
  const DEFAULT_PORTS = [22, 80, 443, 3389];
  type Liveness = { online: boolean; checkedAt: string; lastSeen: string | null; latencyMs: number | null };
  const liveness = new Map<string, Liveness>();

  const tcpOpen = (host: string, port: number) =>
    new Promise<boolean>((resolve) => {
      const sock = new net.Socket();
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        sock.destroy();
        resolve(ok);
      };
      sock.setTimeout(PROBE_TIMEOUT_MS);
      sock.once("connect", () => done(true));
      sock.once("timeout", () => done(false));
      sock.once("error", () => done(false));
      sock.connect(port, host);
    });

  const probeHost = async (m: InventoryMachine): Promise<void> => {
    if (!m.ip) return;
    const ports = m.ports?.length ? m.ports : DEFAULT_PORTS;
    const started = Date.now();
    // First port to answer decides it; the rest are abandoned.
    const online = (await Promise.all(ports.map((p) => tcpOpen(m.ip!, p)))).some(Boolean);
    const prev = liveness.get(m.ip);
    liveness.set(m.ip, {
      online,
      checkedAt: new Date().toISOString(),
      lastSeen: online ? new Date().toISOString() : prev?.lastSeen ?? null,
      latencyMs: online ? Date.now() - started : null,
    });
  };

  const sweep = async () => {
    const inv = loadInventory();
    if (!inv) return;
    const targets = inv.machines.filter((m) => m.include && m.ip);
    for (let i = 0; i < targets.length; i += PROBE_CONCURRENCY) {
      await Promise.all(targets.slice(i, i + PROBE_CONCURRENCY).map(probeHost));
    }
  };
  // Kick off immediately so the first page load is not blank, then keep it warm.
  void sweep();
  const sweepTimer = setInterval(() => void sweep(), PROBE_INTERVAL_MS);
  sweepTimer.unref?.();

  const withLiveness = (m: InventoryMachine) => {
    const { ip, ports, ...rest } = m;
    const l = ip ? liveness.get(ip) : undefined;
    return {
      ...rest,
      online: l?.online ?? null,
      checkedAt: l?.checkedAt ?? null,
      lastSeen: l?.lastSeen ?? null,
      latencyMs: l?.latencyMs ?? null,
    };
  };

  app.get("/api/lab-inventory", (_req, res) => {
    const inv = loadInventory();
    if (!inv) return res.status(404).json({ error: "Inventory not available" });
    // Public-safe view: addresses stay server-side, same rule as /api/gpus.
    const { machines, ...rest } = inv;
    res.json({ ...rest, machines: shownInventory(inv).map(withLiveness) });
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

      const inv = loadInventory();
      const invByIp = new Map<string, InventoryMachine>();
      inv?.machines.forEach((m) => { if (m.ip) invByIp.set(m.ip, m); });

      // Drop scrape targets that have been relocated: Prometheus still lists them but
      // nothing answers, so they would render as permanently dead cards. A target that
      // is merely between scrapes (reachable, or unknown to the inventory) is kept.
      const relocated = (m: any) => {
        if (m.gpus.length > 0) return false;
        const known = invByIp.get(m.ip);
        return known ? !known.reachable : !m.online;
      };
      const dropped = Object.values(machines).filter(relocated).length;

      const list = Object.values(machines)
        .filter((m: any) => !relocated(m))
        .sort((a: any, b: any) => a.instance.localeCompare(b.instance, undefined, { numeric: true }));
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
      // Second tier: machines with no exporter. They are shown from the inventory so
      // the page reflects the lab's whole capacity, clearly marked as not live.
      const liveIps = new Set(list.map((m: any) => m.ip));
      const listed = inv
        ? shownInventory(inv)
            .filter((m) => !m.virtual && !(m.ip && liveIps.has(m.ip)))
            .map(withLiveness)
        : [];

      // Capacity across both tiers. Guest VMs and display-only cards are excluded so a
      // card passed through to a VM is never counted on both the host and the guest.
      const liveCapacity = list.filter((m: any) => m.gpus.length > 0);
      const countable = listed.filter((m) => m.countsForCapacity && !m.edge);
      const byModel = new Map<string, { model: string; count: number; vramGB: number | null }>();
      const addModel = (model: string, vramGB: number | null) => {
        const name = canonicalGpu(model);
        const e = byModel.get(name) ?? { model: name, count: 0, vramGB };
        e.count += 1;
        if (e.vramGB == null) e.vramGB = vramGB;
        byModel.set(name, e);
      };
      liveCapacity.forEach((m: any) =>
        m.gpus.forEach((g: any) => addModel(g.model || g.name || "GPU", g.memTotal ? Math.round(g.memTotal / 1024 ** 3) : null))
      );
      // Integrated and display-only chips are not compute, and Jetson modules are
      // tallied separately, so neither belongs in the discrete-GPU total.
      countable.forEach((m) =>
        m.gpus.filter((g) => g.class !== "display-only" && g.class !== "edge").forEach((g) => addModel(g.model, g.vramGB))
      );
      const gpuModels = [...byModel.values()].sort((a, b) => (b.vramGB ?? 0) - (a.vramGB ?? 0) || a.model.localeCompare(b.model));
      const sum = (ns: (number | null | undefined)[]) => ns.reduce((t: number, n) => t + (n ?? 0), 0);

      res.json({
        updatedAt: new Date().toISOString(),
        source: inv ? "prometheus+inventory" : "prometheus",
        summary: {
          machinesTotal: list.length,
          machinesOnline: online.length,
          gpusOnline: gpuCount,
          gpusBusy: busy,
          // Whole-lab figures spanning the live and the listed tier.
          machinesTracked: liveCapacity.length + countable.length,
          gpusTotal: gpuModels.reduce((n, e) => n + e.count, 0),
          vramTotalGB: gpuModels.reduce((n, e) => n + e.count * (e.vramGB ?? 0), 0),
          cpuThreadsTotal:
            sum(liveCapacity.map((m: any) => invByIp.get(m.ip)?.cpuThreads)) +
            sum(countable.map((m) => m.cpuThreads)),
          ramTotalGB:
            sum(liveCapacity.map((m: any) => invByIp.get(m.ip)?.ramGB)) +
            sum(countable.map((m) => m.ramGB)),
          edgeDevices: listed.filter((m) => m.edge).length,
          // Running state across both tiers, which is what the page is asked to show.
          hostsUp: online.length + listed.filter((m) => m.online === true).length,
          hostsTotal: list.length + listed.length,
          probedAt: listed.find((m) => m.checkedAt)?.checkedAt ?? null,
          relocatedHidden: inv ? inv.machines.filter((m) => !m.include).length : dropped,
        },
        gpuModels,
        machines: publicList,
        inventory: inv ? { updatedAt: inv.updatedAt, probedAt: inv.probedAt, machines: listed } : null,
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
