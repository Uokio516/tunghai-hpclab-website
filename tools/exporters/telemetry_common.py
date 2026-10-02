#!/usr/bin/env python3
"""Shared standard-library HTTP support for the read-only lab exporters."""

import copy
import datetime
import json
import math
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    # Jetson Nano/TX2 may still use Python 3.6, before the stdlib added this class.
    daemon_threads = True


MEASUREMENTS = ("util", "memUsed", "memTotal", "temp", "power", "powerLimit")


def iso_time(timestamp):
    return datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def number(value, maximum=None):
    if value is None:
        return None
    match = re.fullmatch(r"\s*([0-9]+(?:\.[0-9]+)?)\s*(?:%|C|W)?\s*", str(value))
    if not match:
        return None
    result = float(match.group(1))
    if not math.isfinite(result) or result < 0 or (maximum is not None and result > maximum):
        return None
    return result


def integer(value):
    if value is not None and re.fullmatch(r"\d+", str(value).strip()):
        return int(value)
    return None


def memory_bytes(value):
    """Parse actual units; never derive capacity from a profile name."""
    if value is None:
        return None
    match = re.fullmatch(r"\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KiB|MiB|GiB|TiB)\s*", str(value))
    if not match:
        return None
    return int(float(match.group(1)) * {"B": 1, "KiB": 1024, "MiB": 1024 ** 2,
                                      "GiB": 1024 ** 3, "TiB": 1024 ** 4}[match.group(2)])


def metric_labels(values):
    def escape(value):
        return str(value).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
    return "{" + ",".join('%s="%s"' % (key, escape(value)) for key, value in values.items()
                          if value is not None) + "}"


class Snapshot:
    def __init__(self, machine_id, interval, prefix):
        self.machine_id = machine_id
        self.interval = interval
        self.prefix = prefix
        self.lock = threading.Lock()
        self.last = {"gpus": []}
        self.success = False
        self.last_success = 0.0
        self.last_attempt = 0.0
        self.duration = 0.0
        self.failures = 0

    def update(self, payload, duration):
        now = time.time()
        with self.lock:
            self.last_attempt = now
            self.duration = duration
            self.success = payload is not None
            if self.success:
                self.last = copy.deepcopy(payload)
                self.last_success = now
                for gpu in self.last.get("gpus", []):
                    gpu["sampledAt"] = iso_time(now)
            else:
                self.failures += 1

    def data(self):
        with self.lock:
            fresh = self.success and time.time() - self.last_success <= max(15, self.interval * 3)
            payload = copy.deepcopy(self.last)
            timestamp = iso_time(self.last_success) if self.last_success else None
            payload.update(id=self.machine_id, sampledAt=timestamp, updatedAt=timestamp,
                           lastSuccessAt=timestamp, collectionSuccess=fresh, online=fresh)
            if not fresh:
                for gpu in payload.get("gpus", []):
                    for key in MEASUREMENTS:
                        gpu[key] = None
                    gpu["utilAvailable"] = False
                    gpu["utilUnavailableReason"] = "collection-failed"
                    for part in gpu.get("migSlices", []):
                        part["memUsed"] = None
                        part["memTotal"] = None
                payload.pop("sharedMemory", None)
                payload.pop("system", None)
                payload.pop("cpuCounters", None)
            return payload

    def status_metrics(self):
        with self.lock:
            fresh = self.success and time.time() - self.last_success <= max(15, self.interval * 3)
            prefix = self.prefix
            return [
                "# TYPE %s_last_collect_success gauge" % prefix,
                "%s_last_collect_success %d" % (prefix, fresh),
                "%s_last_success_timestamp_seconds %.6f" % (prefix, self.last_success),
                "%s_last_attempt_timestamp_seconds %.6f" % (prefix, self.last_attempt),
                "%s_collect_duration_seconds %.6f" % (prefix, self.duration),
                "%s_collect_failures_total %d" % (prefix, self.failures),
            ]


def serve(collector, listen, port, interval):
    stop = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def do_GET(self):
            if self.path in ("/telemetry", "/json"):
                body = json.dumps(collector.snapshot.data(), ensure_ascii=False,
                                  allow_nan=False).encode("utf-8")
                status, content_type = 200, "application/json; charset=utf-8"
            elif self.path == "/metrics":
                body = collector.metrics().encode("utf-8")
                status, content_type = 200, "text/plain; version=0.0.4; charset=utf-8"
            elif self.path == "/health":
                healthy = collector.snapshot.data()["collectionSuccess"]
                body = b"ok\n" if healthy else b"collection unavailable\n"
                status, content_type = (200 if healthy else 503), "text/plain"
            else:
                body, status, content_type = b"not found\n", 404, "text/plain"
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass  # Never log an internal client address.

    def poll():
        while not stop.is_set():
            started = time.monotonic()
            collector.collect()
            stop.wait(max(0.1, interval - (time.monotonic() - started)))

    server = ThreadingHTTPServer((listen, port), Handler)
    server.daemon_threads = True
    threading.Thread(target=poll, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


def validate_args(parser, args):
    if not (2 <= args.interval <= 60 and 1 <= args.timeout <= 10 and 1 <= args.port <= 65535):
        parser.error("interval, timeout or port is outside the supported range")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", args.id):
        parser.error("id must be an inventory ID containing only letters, numbers, _ or -")


def output_once(collector, output_format):
    collector.collect()
    if output_format == "json":
        print(json.dumps(collector.snapshot.data(), ensure_ascii=False, allow_nan=False))
    else:
        print(collector.metrics(), end="")
    return 0 if collector.snapshot.data()["collectionSuccess"] else 1
