// Isolated API checks: synthetic Prometheus, temporary SQLite, no lab probes.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(path.join(os.tmpdir(), 'hpclab-monitor-test-'));
let utilization = .37, age = 0, collectSuccess = 1, up = 1, failure = false;
let migCount = 4, telemetryAge = 0;
await writeFile(path.join(work, 'gpu-capabilities.default.json'), await readFile(path.join(root, 'gpu-capabilities.default.json')));
await writeFile(path.join(work, 'lab-inventory.default.json'), JSON.stringify({
  updatedAt: '2026-10-02', source: 'test', totals: {}, gpuModels: [], machines: [{
    id: 'inv-04', ip: null, ports: [], label: 'A100 test', include: true, reachable: true, virtual: false,
    countsForCapacity: true, edge: false, cpuThreads: 1, ramGB: 1,
    gpus: [{ model: 'NVIDIA A100 40GB', vramGB: 40, class: 'datacenter', passthrough: false }],
  }],
}));
const queries = [];
const metric = { instance: '127.0.0.1:9999', uuid: 'test-gpu', index: '0', gpu: 'RTX 4090', owner: 'Test node' };
const prometheus = http.createServer((req, res) => {
  if (req.url === '/telemetry') {
    const profiles = migCount === 1 ? ['7g.40gb'] : ['3g.20gb', '2g.10gb', '1g.5gb', '1g.5gb'];
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ id: 'a100-lib', updatedAt: new Date(Date.now() - telemetryAge).toISOString(), gpus: [{
      index: '0', migEnabled: true, util: .99, ip: '127.0.0.1', ports: [22],
      memUsed: 250 * 1024 ** 2, memTotal: 40 * 1024 ** 3, temp: 41, power: 40.71,
      migSlices: profiles.map((profile, i) => ({ giId: i, ciId: 0, profile, sm: 14,
        memUsed: 36 * 1024 ** 2, memTotal: Number(profile.split('.')[1].replace('gb', '')) * 1024 ** 3 })),
    }] }));
  }
  const query = new URL(req.url, 'http://localhost').searchParams.get('query');
  queries.push(query);
  const values = {
    nvidia_smi_gpu_info: 1,
    'up{job="gpu-nodes"}': up,
    nvidia_smi_utilization_gpu_ratio: utilization,
    'timestamp(nvidia_smi_utilization_gpu_ratio)': Date.now() / 1000 - age,
    nvidia_smi_last_collect_success: collectSuccess,
    nvidia_smi_memory_total_bytes: 24 * 1024 ** 3,
  };
  const result = query in values ? [{ metric, value: [Date.now() / 1000, String(values[query])] }] : [];
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(failure ? { status: 'error', error: 'synthetic failure' } : { status: 'success', data: { result } }));
});
await new Promise(resolve => prometheus.listen(0, '127.0.0.1', resolve));
const reserve = http.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), path.join(root, 'server.ts')], {
  cwd: work, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), PROMETHEUS_URL: `http://127.0.0.1:${prometheus.address().port}`, GPU_TELEMETRY_URL: `http://127.0.0.1:${prometheus.address().port}/telemetry`, ADMIN_PASSWORD: '' },
  stdio: 'ignore',
});
const endpoint = `http://127.0.0.1:${port}/api/gpus`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(endpoint)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Isolated server did not start');
  const read = async () => {
    const response = await fetch(endpoint);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  let data = await read();
  assert.equal(data.machines[0].gpus[0].util, .37);
  assert.ok(Date.now() - Date.parse(data.machines[0].gpus[0].sampledAt) < 5000);
  assert.ok(!queries.some(query => query.startsWith('avg_over_time')));
  assert.ok(!JSON.stringify(data).includes('127.0.0.1'));
  assert.equal(data.machines[0].telemetryStatus, 'healthy');
  utilization = .86;
  assert.equal((await read()).machines[0].gpus[0].util, .86);
  age = 180;
  data = await read();
  assert.equal(data.machines[0].gpus[0].util, null);
  assert.equal(data.machines[0].telemetryStatus, 'awaiting-data');
  age = 0; collectSuccess = 0;
  data = await read();
  assert.equal(data.machines[0].gpus[0].util, null);
  assert.equal(data.machines[0].telemetryStatus, 'collector-error');
  collectSuccess = 1; up = 0;
  assert.equal((await read()).machines[0].gpus[0].util, null);
  failure = true;
  assert.equal((await fetch(endpoint)).status, 502);
  failure = false; up = 1;
  assert.equal((await read()).machines[0].gpus[0].util, .86);
  const inventory = await (await fetch(`http://127.0.0.1:${port}/api/lab-inventory`)).json();
  const mig = inventory.machines[0].gpus[0];
  assert.equal(mig.util, null); assert.equal(mig.utilAvailable, false);
  assert.equal(mig.utilUnavailableReason, 'mig-enabled'); assert.equal(mig.migSlices.length, 4);
  assert.equal(mig.temp, 41); assert.equal(mig.power, 40.71);
  assert.ok(!JSON.stringify(inventory).includes('127.0.0.1'));
  assert.ok(!('ip' in mig) && !('ports' in mig));
  migCount = 1;
  let switched = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    const next = await read();
    if (next.inventory.machines[0].gpus[0].migSlices.length === 1) { switched = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(switched, 'Dynamic MIG configuration did not refresh');
  assert.equal((await read()).summary.gpusTotal, 2, 'MIG slices were double-counted as physical GPUs');
  telemetryAge = 180000;
  let expired = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    const next = (await read()).inventory.machines[0].gpus[0];
    if (next.memUsed == null && next.temp == null && next.power == null) {
      assert.equal(next.utilAvailable, false);
      assert.equal(next.migSlices[0].memUsed, null);
      expired = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(expired, 'Stale MIG measurements were retained as live data');
  console.log('PASS: latest samples, timestamps, changing utilization, stale/failed/offline telemetry, no-store, privacy, error recovery.');
  console.log('PASS: MIG cannot become 0% or 99% utilization; real memory/temperature/power, safe provider fields, dynamic slices, no double-counting, stale values removed.');
} finally {
  child.kill();
  if (child.exitCode == null) await new Promise(resolve => child.once('exit', resolve));
  await new Promise(resolve => prometheus.close(resolve));
  assert.equal(path.dirname(path.resolve(work)), path.resolve(os.tmpdir()));
  await rm(work, { recursive: true, force: true });
}
