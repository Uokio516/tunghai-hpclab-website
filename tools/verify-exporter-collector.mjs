// Run: node --import tsx tools/verify-exporter-collector.mjs
// No external requests: a bounded fake exporter verifies measurement semantics.
import assert from 'node:assert/strict';
import { ExporterCollector, parseMetrics } from '../exporter-collector.ts';

const epoch = Date.now();
let step = 0, fail = false, active = 0, maximumActive = 0, requests = 0;
const targets = [
  { machineId: 'inv-37', capacityHostId: 'inv-37', kind: 'node', url: 'http://synthetic/node' },
  { machineId: 'inv-52', capacityHostId: 'inv-37', kind: 'nvidia', url: 'http://synthetic/gpu' },
  { machineId: 'inv-53', capacityHostId: 'inv-37', kind: 'nvidia', url: 'http://synthetic/duplicate' },
  { machineId: 'inv-04', capacityHostId: 'inv-04', kind: 'gpu-json', url: 'http://synthetic/mig' },
  { machineId: 'inv-68', capacityHostId: 'inv-68', kind: 'gpu-json', url: 'http://synthetic/jetson' },
];
const gpuMetrics = () => `
nvidia_smi_last_collect_success 1
nvidia_smi_last_success_timestamp_seconds ${epoch / 1000}
nvidia_smi_gpu_info{uuid="GPU-private-identity",index="0",hostname="203.0.113.77",owner="private"} 1
nvidia_smi_utilization_gpu_ratio{uuid="GPU-private-identity",index="0"} 0.73
nvidia_smi_sample_timestamp_seconds{uuid="GPU-private-identity",index="0"} ${epoch / 1000}
nvidia_smi_memory_total_bytes{uuid="GPU-private-identity",index="0"} 11811160064
nvidia_smi_memory_used_bytes{uuid="GPU-private-identity",index="0"} 1073741824
nvidia_smi_temperature_gpu{uuid="GPU-private-identity",index="0"} NaN
nvidia_smi_power_draw_watts{uuid="GPU-private-identity",index="0"} +Inf
`;
const fetcher = async (url, options) => {
  assert.ok(options.signal, 'Collection must have a timeout signal');
  requests++; active++; maximumActive = Math.max(maximumActive, active);
  await new Promise(resolve => setTimeout(resolve, 15));
  active--;
  if (fail) throw new Error('synthetic failure with private target URL');
  if (url.endsWith('/node')) return new Response(`
node_cpu_seconds_total{cpu="0",mode="idle"} ${100 + step * 8}
node_cpu_seconds_total{cpu="0",mode="user"} ${30 + step * 2}
node_cpu_seconds_total{cpu="0",mode="guest"} ${10 + step * 100}
node_memory_MemTotal_bytes 8589934592
node_memory_MemAvailable_bytes 6442450944
`);
  if (url.endsWith('/mig')) return Response.json({ collectionSuccess: true, sampledAt: new Date(epoch).toISOString(),
    ip: '203.0.113.77', ports: [22], url: 'http://private', gpus: [{ index: '0', uuid: 'GPU-a100',
      migEnabled: true, util: .99, memUsed: 300 * 1024 ** 2, memTotal: 40 * 1024 ** 3,
      migSlices: [{ giId: 7, ciId: 0, profile: '1g.5gb', sm: 14, memUsed: 32 * 1024 ** 2, memTotal: 5 * 1024 ** 3 }],
    }] });
  if (url.endsWith('/jetson')) return Response.json({ collectionSuccess: true, sampledAt: new Date(epoch).toISOString(),
    sharedMemory: { used: 2 * 1024 ** 3, total: 8 * 1024 ** 3 },
    system: { cpuUtil: 25, memTotal: 8 * 1024 ** 3, memAvailable: 6 * 1024 ** 3 },
    gpus: [{ index: '0', util: .45, utilAvailable: true, memoryShared: true }],
  });
  return new Response(gpuMetrics());
};
const collector = new ExporterCollector(targets, fetcher, 2);
await Promise.all([collector.refresh(), collector.refresh()]);
assert.equal(requests, targets.length, 'Overlapping sweeps were not suppressed');
assert.ok(maximumActive <= 2, 'Bounded concurrency was exceeded');
let host = collector.snapshot('inv-37');
assert.equal(host.cpuPercent, null, 'First CPU sample invented a utilization value');
assert.equal(host.ramUsed, 2 * 1024 ** 3);
assert.equal(host.gpus.length, 1, 'The same physical GPU was counted twice');
assert.equal(host.gpus[0].util, .73);
assert.equal(Date.parse(host.gpus[0].sampledAt), epoch, 'Collection success timestamp became HTTP fetch time');
assert.equal(host.gpus[0].temp, null); assert.equal(host.gpus[0].power, null);
assert.equal(collector.snapshot('inv-52'), null, 'Passthrough GPU was exposed as a second physical machine');
const publicBody = JSON.stringify(host);
for (const privatePart of ['uuid', 'GPU-private-identity', '203.0.113.77', 'http://', 'ports', 'instance', 'hostname']) assert.ok(!publicBody.includes(privatePart));
step = 1;
await collector.refresh();
host = collector.snapshot('inv-37');
assert.ok(Math.abs(host.cpuPercent - 20) < 1e-8, 'CPU delta included guest counters a second time');
const mig = collector.snapshot('inv-04').gpus[0];
assert.equal(mig.util, null); assert.equal(mig.utilAvailable, false);
assert.equal(mig.migSlices.length, 1); assert.equal(mig.migSlices[0].giId, 7);
const jetson = collector.snapshot('inv-68');
assert.equal(jetson.gpus[0].util, .45); assert.equal(jetson.gpus[0].memUsed, null);
assert.equal(jetson.sharedMemory.used, 2 * 1024 ** 3);
assert.equal(jetson.cpuPercent, 25); assert.equal(jetson.ramUsed, 2 * 1024 ** 3);
assert.equal(collector.snapshot('inv-37', epoch + 121000).gpus[0].util, null);
assert.equal(collector.snapshot('inv-04', epoch + 121000).gpus[0].migSlices[0].memUsed, null);
fail = true;
await collector.refresh();
host = collector.snapshot('inv-37');
assert.equal(host.telemetryStatus, 'collector-error'); assert.equal(host.gpus[0].util, null);
assert.equal(Date.parse(host.gpus[0].sampledAt), epoch, 'Failed scrape advanced the last success timestamp');
assert.ok(host.lastSeen != null, 'Collection failure erased the last successful response');
const escaped = parseMetrics('test_metric{label="quote\\\" and line\\n"} 4 12345\nunsupported NaN\n');
assert.equal(escaped.length, 1); assert.equal(escaped[0].labels.label, 'quote" and line\n');
assert.equal(escaped[0].timestamp, 12345);
let pushPolls = 0;
const pushCollector = new ExporterCollector([{ machineId: 'inv-25', capacityHostId: 'inv-25', kind: 'node', url: 'http://synthetic/private', transport: 'push' }],
  async () => { pushPolls++; throw new Error('Push source must never be polled'); });
assert.equal(pushCollector.ingestPush('inv-99', 'node', 'node_memory_MemTotal_bytes 4'), false);
assert.equal(pushCollector.ingestPush('inv-25', 'nvidia', gpuMetrics()), false);
assert.equal(pushCollector.ingestPush('inv-25', 'node', 'node_memory_MemTotal_bytes 8192\nnode_memory_MemAvailable_bytes 4096', new Date(epoch).toISOString()), true);
await pushCollector.refresh();
assert.equal(pushPolls, 0, 'Direct polling overwrote push state');
assert.equal(pushCollector.snapshot('inv-25').ramUsed, 4096);
assert.equal(Date.parse(pushCollector.snapshot('inv-25').systemSampledAt), epoch);
assert.equal(pushCollector.snapshot('inv-25', epoch + 121000).ramUsed, null);
console.log('PASS: non-overlapping bounded collection, GPU UUID deduplication, VM-to-physical mapping, CPU deltas, true sample times, unavailable values, privacy, failure/stale handling, MIG and Jetson semantics.');
console.log('PASS: push source allowlist, original sample time, pull exclusion, stale push data.');
