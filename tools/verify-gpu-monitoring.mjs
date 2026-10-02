// Isolated API checks: synthetic Prometheus, temporary SQLite, no lab probes.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(path.join(os.tmpdir(), 'hpclab-monitor-test-'));
let utilization = .37, age = 0, collectSuccess = 1, up = 1, failure = false;
const queries = [];
const metric = { instance: '127.0.0.1:9999', uuid: 'test-gpu', index: '0', gpu: 'RTX 4090', owner: 'Test node' };
const prometheus = http.createServer((req, res) => {
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
  cwd: work, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), PROMETHEUS_URL: `http://127.0.0.1:${prometheus.address().port}`, ADMIN_PASSWORD: '' },
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
  console.log('PASS: latest samples, timestamps, changing utilization, stale/failed/offline telemetry, no-store, privacy, error recovery.');
} finally {
  child.kill();
  if (child.exitCode == null) await new Promise(resolve => child.once('exit', resolve));
  await new Promise(resolve => prometheus.close(resolve));
  assert.equal(path.dirname(path.resolve(work)), path.resolve(os.tmpdir()));
  await rm(work, { recursive: true, force: true });
}
