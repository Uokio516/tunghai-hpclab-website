#!/usr/bin/env python3
"""Read-only Jetson tegrastats + /proc exporter; shared RAM is never GPU VRAM.

GR3D_FREQ is documented GPU activation time, not a CUDA SM percentage.
https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/AT/JetsonLinuxDevelopmentTools/TegrastatsUtility.html
The child process is terminated directly; --stop is never used because it could
stop another operator's tegrastats process.
"""

import argparse
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from telemetry_common import Snapshot, metric_labels, number, output_once, serve, validate_args


def parse_tegrastats(text, model="NVIDIA Jetson"):
    samples = [line for line in text.splitlines() if re.search(r"\bRAM\s+\d+/\d+MB\b", line)]
    if not samples:
        raise ValueError("no complete tegrastats sample")
    line = samples[-1]
    memory = re.search(r"\bRAM\s+(\d+)/(\d+)MB\b", line)
    if int(memory.group(1)) > int(memory.group(2)) or int(memory.group(2)) == 0:
        raise ValueError("invalid tegrastats RAM sample")
    activation = re.search(r"\bGR3D(?:_FREQ)?\s+(\d+(?:\.\d+)?)%", line)
    util = number(activation.group(1), maximum=100) if activation else None
    temperature = re.search(r"(?:^|\s)GPU@([0-9]+(?:\.[0-9]+)?)C\b", line, re.IGNORECASE)
    # Only a dedicated GPU rail qualifies as GPU power; CPU_GPU_CV/board rails do not.
    power = re.search(r"(?:^|\s)(?:VDD_GPU|POM_5V_GPU)\s+(\d+(?:\.\d+)?)(?:mW)?/\d+(?:\.\d+)?(?:mW)?\b", line)
    gpu = {
        "index": "0", "name": model, "util": util / 100 if util is not None else None, "utilAvailable": util is not None,
        "utilUnavailableReason": None if util is not None else "unsupported",
        "utilMetric": "gpu-activation", "memoryShared": True,
        "memUsed": None, "memTotal": None, "powerLimit": None,
        "temp": float(temperature.group(1)) if temperature else None,
        "power": float(power.group(1)) / 1000 if power else None,
        "migEnabled": False, "migSlices": [],
    }
    # tegrastats reports Linux RAM in MB (MiB quantities). Preserve its actual
    # shared RAM reading at machine level; do not map it to GPU memory metrics.
    return {"source": "tegrastats", "gpus": [gpu],
            "sharedMemory": {"used": int(memory.group(1)) * 1024 ** 2,
                             "total": int(memory.group(2)) * 1024 ** 2}}


def read_proc(proc_root="/proc"):
    root = Path(proc_root)
    memory = {}
    for line in (root / "meminfo").read_text(encoding="ascii").splitlines():
        match = re.fullmatch(r"(MemTotal|MemAvailable|MemFree|Buffers|Cached|SReclaimable|Shmem):\s+(\d+) kB", line)
        if match:
            memory[match.group(1)] = int(match.group(2)) * 1024
    if not memory.get("MemTotal"):
        raise ValueError("missing host memory")
    available = memory.get("MemAvailable")
    if available is None:
        # Linux kernels preceding MemAvailable: the established free/cache sum.
        required = ("MemFree", "Buffers", "Cached")
        if all(key in memory for key in required):
            available = sum(memory[key] for key in required) + memory.get("SReclaimable", 0) - memory.get("Shmem", 0)
    counters = {}
    for line in (root / "stat").read_text(encoding="ascii").splitlines():
        fields = line.split()
        if fields and re.fullmatch(r"cpu\d*", fields[0]) and len(fields) >= 5:
            ticks = [int(value) for value in fields[1:9]]
            ticks += [0] * (8 - len(ticks))
            counters[fields[0]] = ticks
    if "cpu" not in counters:
        raise ValueError("missing CPU counters")
    return {"memTotal": memory["MemTotal"], "memAvailable": max(0, min(memory["MemTotal"], available))
            if available is not None else None, "counters": counters}


def cpu_util(previous, current):
    if previous is None:
        return None
    delta = [now - before for before, now in zip(previous, current)]
    total = sum(delta)
    if total <= 0 or any(value < 0 for value in delta):
        return None
    return max(0, min(100, (1 - (delta[3] + delta[4]) / total) * 100))


def read_tegrastats(binary, timeout):
    # A pseudo-terminal keeps C stdio line-buffered. A PIPE can otherwise hide
    # every short sample until tegrastats fills its output buffer.
    import pty
    import select
    master, slave = pty.openpty()
    process = None
    chunks = []
    size = 0
    deadline = time.monotonic() + timeout
    try:
        process = subprocess.Popen([binary, "--interval", "1000"], stdin=subprocess.DEVNULL,
                                   stdout=slave, stderr=subprocess.DEVNULL, start_new_session=True,
                                   env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LC_ALL": "C"})
        os.close(slave)
        slave = None
        while time.monotonic() < deadline:
            ready, _, _ = select.select([master], [], [], max(0, deadline - time.monotonic()))
            if not ready:
                break
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break  # PTY returns EIO when the child closes its stdout.
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            if size > 256 * 1024:
                raise ValueError("oversized tegrastats sample")
            output = b"".join(chunks).decode("utf-8", errors="replace")
            # Consume only a complete line, not a partially printed RAM prefix.
            complete = output.rsplit("\n", 1)[0] if "\n" in output else ""
            if re.search(r"\bRAM\s+\d+/\d+MB\b", complete):
                return complete
        raise ValueError("no complete bounded tegrastats sample")
    finally:
        if slave is not None:
            os.close(slave)
        os.close(master)
        if process is not None:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=.5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=.5)


class Collector:
    def __init__(self, binary, machine_id, model="NVIDIA Jetson", interval=5, timeout=2, proc_root="/proc"):
        self.binary = binary
        self.model = model
        self.timeout = timeout
        self.proc_root = proc_root
        self.previous_cpu = None
        self.snapshot = Snapshot(machine_id, interval, "jetson")

    def collect(self):
        started = time.monotonic()
        payload = None
        try:
            payload = parse_tegrastats(read_tegrastats(self.binary, self.timeout), self.model)
            host = read_proc(self.proc_root)
            cpu = cpu_util(self.previous_cpu, host["counters"]["cpu"])
            self.previous_cpu = host["counters"]["cpu"]
            payload["system"] = {"cpuUtil": cpu, "memTotal": host["memTotal"], "memAvailable": host["memAvailable"]}
            payload["cpuCounters"] = host["counters"]
        except (OSError, ValueError, ImportError, subprocess.TimeoutExpired):
            payload = None
        self.snapshot.update(payload, time.monotonic() - started)

    def metrics(self):
        data = self.snapshot.data()
        rows = self.snapshot.status_metrics()
        if not data["collectionSuccess"]:
            return "\n".join(rows) + "\n"
        gpu = data["gpus"][0]
        identity = metric_labels({"index": "0", "name": gpu["name"]})
        rows.append("jetson_gpu_info%s 1" % identity)
        rows.append("jetson_gpu_memory_shared%s 1" % identity)
        rows.append("jetson_gpu_utilization_available%s %d" % (identity, gpu["utilAvailable"]))
        rows.append("jetson_gpu_sample_timestamp_seconds%s %.6f" % (identity, self.snapshot.last_success))
        for key, metric, scale in (("util", "activation_ratio", 1), ("temp", "temperature_celsius", 1),
                                   ("power", "power_draw_watts", 1)):
            if gpu.get(key) is not None:
                rows.append("jetson_gpu_%s%s %.12g" % (metric, identity, gpu[key] * scale))
        shared = data["sharedMemory"]
        rows.append("jetson_shared_memory_used_bytes %d" % shared["used"])
        rows.append("jetson_shared_memory_total_bytes %d" % shared["total"])
        system = data["system"]
        rows.append("node_memory_MemTotal_bytes %d" % system["memTotal"])
        if system["memAvailable"] is not None:
            rows.append("node_memory_MemAvailable_bytes %d" % system["memAvailable"])
        if system["cpuUtil"] is not None:
            rows.append("jetson_cpu_utilization_ratio %.12g" % (system["cpuUtil"] * .01))
        hz = os.sysconf("SC_CLK_TCK")
        modes = ("user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal")
        for cpu, counters in data.get("cpuCounters", {}).items():
            if cpu == "cpu":
                continue
            for mode, ticks in zip(modes, counters):
                rows.append("node_cpu_seconds_total%s %.12g" %
                            (metric_labels({"cpu": cpu[3:], "mode": mode}), ticks / hz))
        return "\n".join(rows) + "\n"


def model_name():
    try:
        model = Path("/proc/device-tree/model").read_text(encoding="utf-8").strip("\x00\n ")
        return model or "NVIDIA Jetson"
    except OSError:
        return "NVIDIA Jetson"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", required=True)
    parser.add_argument("--listen", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9401)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--timeout", type=float, default=2)
    parser.add_argument("--binary", default=shutil.which("tegrastats"))
    parser.add_argument("--model", default=model_name())
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--format", choices=("json", "metrics"), default="metrics")
    args = parser.parse_args()
    validate_args(parser, args)
    if not args.binary:
        parser.exit(2, "tegrastats not found; this tool never installs JetPack or drivers.\n")
    collector = Collector(args.binary, args.id, args.model, args.interval, args.timeout)
    if args.once:
        return output_once(collector, args.format)
    serve(collector, args.listen, args.port, args.interval)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
