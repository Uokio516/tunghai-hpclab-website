#!/usr/bin/env python3
"""Read-only Prometheus metrics relay for an isolated GPU-cluster node."""

import argparse
import http.server
import ipaddress
import urllib.request


class Handler(http.server.BaseHTTPRequestHandler):
    source = ""
    expected = b"node_cpu_seconds_total"
    timeout = 3

    def do_GET(self):
        if self.path == "/-/healthy":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok\n")
            return
        if self.path != "/metrics":
            self.send_error(404)
            return
        try:
            request = urllib.request.Request(self.source, headers={"Accept-Encoding": "identity"})
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(request, timeout=self.timeout) as response:
                data = response.read(4 * 1024 * 1024 + 1)
            if len(data) > 4 * 1024 * 1024 or self.expected not in data:
                raise ValueError("invalid metrics")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (OSError, ValueError):
            self.send_error(502, "Metrics source unavailable")

    def log_message(self, _fmt, *_args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--kind", choices=("node", "gpu"), default="node")
    parser.add_argument("--listen-port", type=int, default=9300)
    parser.add_argument("--source-port", type=int)
    args = parser.parse_args()
    ipaddress.IPv4Address(args.listen)
    upstream = ipaddress.IPv4Address(args.source)
    if not upstream.is_private:
        parser.error("source must be a private IPv4 address")
    if args.listen_port not in (9300, 9301):
        parser.error("unexpected relay port")
    source_port = args.source_port or (9100 if args.kind == "node" else 9835)
    if source_port not in (9100, 9835, 19100, 19835) or (source_port in (19100, 19835) and not upstream.is_loopback):
        parser.error("unexpected source port")
    Handler.source = "http://%s:%d/metrics" % (upstream, source_port)
    Handler.expected = b"node_cpu_seconds_total" if args.kind == "node" else b"nvidia_smi_gpu_info"
    server = http.server.ThreadingHTTPServer((args.listen, args.listen_port), Handler)
    server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
