#!/usr/bin/env python3
"""Read-only NVIDIA exporter. Standard library only; unsupported values are omitted."""

import argparse
import csv
import io
import math
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_FIELDS = (
    "index", "uuid", "name", "driver_version", "utilization.gpu",
    "memory.used", "memory.total", "temperature.gpu", "power.draw",
    "power.limit", "fan.speed",
)
METRICS = (
    ("nvidia_smi_utilization_gpu_ratio", "utilization.gpu", .01),
    ("nvidia_smi_memory_used_bytes", "memory.used", 1024 ** 2),
    ("nvidia_smi_memory_total_bytes", "memory.total", 1024 ** 2),
    ("nvidia_smi_temperature_gpu", "temperature.gpu", 1),
    ("nvidia_smi_power_draw_watts", "power.draw", 1),
    ("nvidia_smi_power_limit_watts", "power.limit", 1),
    ("nvidia_smi_fan_speed_ratio", "fan.speed", .01),
)


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, TypeError):
        return None


def labels(values):
    def escape(value):
        return str(value).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
    return "{" + ",".join('%s="%s"' % (key, escape(value)) for key, value in values.items()) + "}"


class Collector:
    def __init__(self, binary, timeout, interval):
        self.binary = binary
        self.timeout = timeout
        self.interval = interval
        self.lock = threading.Lock()
        self.gpus = []
        self.identities = []
        self.success = False
        self.exit_code = -1
        self.sampled_at = 0.0
        self.last_success_at = 0.0
        self.duration = 0.0
        self.failures = 0
        self.has_mig_field = True

    def query(self, fields):
        return subprocess.run(
            [self.binary, "--query-gpu=" + ",".join(fields), "--format=csv,noheader,nounits"],
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=self.timeout,
            check=False, env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LC_ALL": "C"},
        )

    def collect(self):
        started = time.monotonic()
        gpus = []
        exit_code = -1
        try:
            fields = BASE_FIELDS + (("mig.mode.current",) if self.has_mig_field else ())
            result = self.query(fields)
            # Older drivers reject mig.mode.current. Only retry for an unsupported field;
            # permission/driver errors must not trigger repeated expensive calls.
            if result.returncode and self.has_mig_field and re.search(
                r"(not a valid field|invalid field|field.*not.*supported)",
                result.stdout + result.stderr, re.IGNORECASE,
            ):
                self.has_mig_field = False
                fields = BASE_FIELDS
                result = self.query(fields)
            exit_code = result.returncode
            if result.returncode == 0:
                for row in csv.reader(io.StringIO(result.stdout), skipinitialspace=True):
                    if not row:
                        continue
                    if len(row) != len(fields):
                        raise ValueError("unexpected field count")
                    gpu = dict(zip(fields, (value.strip() for value in row)))
                    if not gpu["index"].isdigit() or not gpu["uuid"].startswith("GPU-"):
                        raise ValueError("unexpected GPU identity")
                    gpus.append(gpu)
                if not gpus:
                    exit_code = -2
        except subprocess.TimeoutExpired:
            exit_code = 124
        except (OSError, ValueError, csv.Error):
            exit_code = -2
        with self.lock:
            self.success = exit_code == 0 and bool(gpus)
            self.exit_code = exit_code
            self.sampled_at = time.time()
            self.duration = time.monotonic() - started
            if self.success:
                self.gpus = gpus
                self.identities = gpus
                self.last_success_at = self.sampled_at
            else:
                self.gpus = []
                self.failures += 1

    def healthy(self):
        with self.lock:
            return self.success and time.time() - self.sampled_at <= max(15, self.interval * 3)

    def metrics(self):
        with self.lock:
            fresh = self.success and time.time() - self.sampled_at <= max(15, self.interval * 3)
            rows = [
                "# HELP nvidia_smi_last_collect_success Whether the latest bounded read succeeded.",
                "# TYPE nvidia_smi_last_collect_success gauge",
                "nvidia_smi_last_collect_success %d" % fresh,
                "nvidia_smi_command_exit_code %d" % self.exit_code,
                "nvidia_smi_last_success_timestamp_seconds %.6f" % self.last_success_at,
                "nvidia_smi_collect_duration_seconds %.6f" % self.duration,
                "nvidia_smi_collect_failures_total %d" % self.failures,
            ]
            # Identity may remain during a failed sample; measurements never do.
            for gpu in self.identities:
                identity = {"index": gpu["index"], "uuid": gpu["uuid"],
                            "name": gpu["name"], "gpu": gpu["name"],
                            "driver_version": gpu["driver_version"]}
                rows.append("nvidia_smi_gpu_info%s 1" % labels(identity))
            for gpu in self.gpus if fresh else []:
                identity = labels({"index": gpu["index"], "uuid": gpu["uuid"]})
                mig_mode = gpu.get("mig.mode.current", "Unknown")
                mig_enabled = mig_mode.lower() == "enabled"
                mig_unknown = mig_mode == "Unknown" and bool(re.search(
                    r"\b(A100|A30|H100|H200|B100|B200|GB200)\b", gpu["name"], re.IGNORECASE,
                ))
                util = number(gpu["utilization.gpu"])
                available = util is not None and not mig_enabled and not mig_unknown
                rows.append("nvidia_smi_utilization_available%s %d" % (identity, available))
                if mig_mode != "Unknown":
                    rows.append("nvidia_smi_mig_enabled%s %d" % (identity, mig_enabled))
                rows.append("nvidia_smi_sample_timestamp_seconds%s %.6f" % (identity, self.sampled_at))
                for metric, field, scale in METRICS:
                    value = number(gpu[field])
                    if metric == "nvidia_smi_utilization_gpu_ratio" and not available:
                        continue
                    if value is not None:
                        rows.append("%s%s %.12g" % (metric, identity, value * scale))
            return ("\n".join(rows) + "\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listen", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9835)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--timeout", type=float, default=4)
    parser.add_argument("--binary", default=shutil.which("nvidia-smi"))
    parser.add_argument("--once", action="store_true", help="Perform one bounded read and print metrics.")
    args = parser.parse_args()
    if not args.binary:
        parser.exit(2, "nvidia-smi not found; driver installation is outside this exporter.\n")
    if not (1 <= args.timeout <= 10 and 2 <= args.interval <= 60 and 1 <= args.port <= 65535):
        parser.error("timeout, interval or port is outside the supported range")
    collector = Collector(args.binary, args.timeout, args.interval)
    collector.collect()
    if args.once:
        print(collector.metrics().decode(), end="")
        return 0 if collector.healthy() else 1

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def do_GET(self):
            if self.path == "/metrics":
                body, code, content_type = collector.metrics(), 200, "text/plain; version=0.0.4; charset=utf-8"
            elif self.path == "/health":
                healthy = collector.healthy()
                body, code, content_type = (b"ok\n" if healthy else b"collection unavailable\n"), (200 if healthy else 503), "text/plain"
            else:
                body, code, content_type = b"not found\n", 404, "text/plain"
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass  # Access logs must not publish internal client addresses.

    def poll():
        while True:
            time.sleep(args.interval)
            collector.collect()

    server = ThreadingHTTPServer((args.listen, args.port), Handler)
    server.daemon_threads = True
    threading.Thread(target=poll, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
