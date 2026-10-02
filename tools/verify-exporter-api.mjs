// Synthetic HTTP integration: no credentials, no external targets, temporary DB.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(path.join(os.tmpdir(), 'hpclab-exporter-api-'));
let step = 0, age = 0, promFailure = false;
const metrics = () => `node_cpu_seconds_total{cpu="0",mode="idle"} ${100 + step * 8}\nnode_cpu_seconds_total{cpu="0",mode="user"} ${20 + step * 2}\nnode_memory_MemTotal_bytes 68719476736\nnode_memory_MemAvailable_bytes 51539607552\n`;
const gpu = () => `nvidia_smi_last_collect_success 1\nnvidia_smi_last_success_timestamp_seconds ${Date.now() / 1000 - age}\nnvidia_smi_gpu_info{uuid="GPU-internal-identity",index="0"} 1\nnvidia_smi_utilization_gpu_ratio{uuid="GPU-internal-identity",index="0"} .61\nnvidia_smi_memory_total_bytes{uuid="GPU-internal-identity",index="0"} 11811160064\n`;
const metric = { instance: '127.0.0.2:9999', hostname: 'real-os-hostname', uuid: 'GPU-prom-private', index: '0', gpu: 'RTX 4090', owner: 'Synthetic library' };
const mock = http.createServer((req, res) => {
  if (req.url === '/node') return res.end(metrics());
  if (req.url === '/gpu') return res.end(gpu());
  const query = new URL(req.url, 'http://localhost').searchParams.get('query');
  const values = { nvidia_smi_gpu_info: 1, 'up{job="gpu-nodes"}': 1, nvidia_smi_utilization_gpu_ratio: .37,
    'timestamp(nvidia_smi_utilization_gpu_ratio)': Date.now() / 1000, nvidia_smi_last_collect_success: 1,
    nvidia_smi_memory_total_bytes: 24 * 1024 ** 3 };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(promFailure ? { status: 'error' } : { status: 'success', data: { result: query in values ? [{ metric, value: [Date.now() / 1000, String(values[query])] }] : [] } }));
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const mockBase = `http://127.0.0.1:${mock.address().port}`;
const models = [{ model: 'RTX 4090', count: 1, vramGB: 24 }, { model: 'RTX 2080 Ti', count: 1, vramGB: 11 }, { model: 'RTX 4090 Laptop', count: 1, vramGB: 16 }];
const machine = (id, model, vramGB, ip, virtual = false) => ({ id, ip, ports: [1], label: id, include: true, reachable: true,
  virtual, countsForCapacity: !virtual, edge: false, cpuThreads: virtual ? 8 : 24, ramGB: virtual ? 16 : 64,
  gpus: [{ model, vramGB, class: 'consumer', passthrough: id === 'inv-37' || virtual }] });
await writeFile(path.join(work, 'lab-inventory.default.json'), JSON.stringify({ updatedAt: '2026-10-02', probedAt: '2026-10-02', source: 'synthetic',
  totals: { machines: 3, gpus: 3, vramGB: 51, cpuThreads: 72, ramGB: 192 }, gpuModels: models,
  machines: [machine('inv-09', 'RTX 4090', 24, '127.0.0.2'), machine('inv-37', 'RTX 2080 Ti', 11, '127.0.0.3'),
    machine('inv-52', 'RTX 2080 Ti', 11, null, true), machine('inv-25', 'RTX 4090 Laptop', 16, null)],
}));
await writeFile(path.join(work, 'exporter-targets.default.json'), JSON.stringify({ targets: [
  { machineId: 'inv-37', capacityHostId: 'inv-37', kind: 'node', url: mockBase + '/node' },
  { machineId: 'inv-52', capacityHostId: 'inv-37', kind: 'nvidia', url: mockBase + '/gpu' },
  { machineId: 'inv-52', capacityHostId: 'inv-52', kind: 'node', url: mockBase + '/node' },
  { machineId: 'inv-25', capacityHostId: 'inv-25', kind: 'node', url: mockBase + '/never-read', transport: 'push' },
  { machineId: 'inv-25', capacityHostId: 'inv-25', kind: 'nvidia', url: mockBase + '/never-read', transport: 'push' },
] }));
const reserve = http.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), path.join(root, 'server.ts')], {
  cwd: work, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), PROMETHEUS_URL: mockBase, GPU_TELEMETRY_URL: '', EXPORTER_PUSH_TOKEN: 'synthetic-token' }, stdio: 'ignore',
});
const api = `http://127.0.0.1:${port}`;
const read = async () => (await fetch(api + '/api/gpus')).json();
const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { const data = await read(); if (predicate(data)) return data; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Synthetic collector did not reach expected state');
};
const post = (payload, token = 'synthetic-token') => fetch(api + '/api/internal/exporter-telemetry', { method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
try {
  let data = await waitFor(data => data.inventory.machines.find(m => m.id === 'inv-37')?.gpus[0]?.util === .61);
  assert.deepEqual([data.summary.gpusTotal, data.summary.vramTotalGB, data.summary.machinesTracked, data.summary.cpuThreadsTotal, data.summary.ramTotalGB], [3, 51, 3, 72, 192]);
  assert.equal(data.inventory.machines.some(m => m.id === 'inv-09'), false, 'OS hostname broke Prometheus-to-inventory joining');
  assert.equal(data.inventory.machines.find(m => m.id === 'inv-52').gpus.length, 0, 'VM GPU was shown twice');
  assert.equal(data.inventory.machines.find(m => m.id === 'inv-37').ramUsed, 16 * 1024 ** 3);
  assert.equal((await post({ machineId: 'inv-25', kind: 'node', metrics: metrics() }, '')).status, 401);
  assert.equal((await post({ machineId: 'inv-25', kind: 'node', metrics: metrics() }, 'wrong-token')).status, 401);
  assert.equal((await post({ machineId: 'inv-99', kind: 'node', metrics: metrics() })).status, 404);
  assert.equal((await post({ machineId: 'inv-37', kind: 'node', metrics: metrics() })).status, 404, 'Pull target accepted unsolicited push');
  assert.equal((await post({ machineId: 'inv-25', kind: 'node', metrics: 'x'.repeat(2 * 1024 ** 2) })).status, 413, 'Push payload limit was not enforced');
  const stamp = new Date().toISOString();
  assert.equal((await post({ machineId: 'inv-25', kind: 'node', metrics: metrics(), sampledAt: stamp })).status, 200);
  assert.equal((await post({ machineId: 'inv-25', kind: 'nvidia', metrics: gpu(), sampledAt: stamp })).status, 200);
  data = await read();
  assert.equal(data.inventory.machines.find(m => m.id === 'inv-25').telemetryStatus, 'healthy');
  assert.equal(data.inventory.machines.find(m => m.id === 'inv-25').systemSampledAt, stamp);
  for (const route of ['/api/gpus', '/api/lab-inventory']) {
    const body = await (await fetch(api + route)).text();
    for (const value of ['127.0.0.', 'GPU-internal-identity', 'GPU-prom-private', 'http://', 'synthetic-token', '"ip"', '"ports"', '"instance"', '"url"']) assert.ok(!body.includes(value), 'Private details escaped the public API');
  }
  step = 1;
  data = await waitFor(data => Math.abs((data.inventory.machines.find(m => m.id === 'inv-37').cpuPercent ?? -100) - 20) < 1e-8);
  promFailure = true;
  data = await read();
  assert.equal(data.prometheusStatus, 'unavailable');
  assert.equal(data.inventory.machines.find(m => m.id === 'inv-37').gpus[0].util, .61, 'Prometheus failure stopped direct exporter monitoring');
  age = 180;
  data = await waitFor(data => data.inventory.machines.find(m => m.id === 'inv-37').gpus[0].util === null);
  assert.equal(data.summary.gpusTotal, 3, 'Stale telemetry altered hardware capacity');
  console.log('PASS: HTTP exporter integration, OS hostname joins, physical/VM GPU mapping, CPU/RAM, stable capacity, partial-source recovery, stale samples, API privacy, authenticated/allowlisted push.');
} finally {
  child.kill();
  if (child.exitCode == null) await new Promise(resolve => child.once('exit', resolve));
  await new Promise(resolve => mock.close(resolve));
  assert.equal(path.dirname(path.resolve(work)), path.resolve(os.tmpdir()));
  await rm(work, { recursive: true, force: true });
}
