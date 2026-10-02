#!/usr/bin/env python3
"""Keep an authorized, loopback-only GPU metrics port-forward alive."""

import json
import argparse
import signal
import subprocess
import threading

KUBECTL = "/var/lib/rancher/rke2/bin/kubectl"
KUBECONFIG = "/etc/rancher/rke2/rke2.yaml"
NODE_NAME = "pk-5090"
stop = threading.Event()


def pod_name(label):
    result = subprocess.run(
        [KUBECTL, "--kubeconfig", KUBECONFIG, "get", "pods", "-n", "default", "-l", label, "-o", "json"],
        capture_output=True, timeout=12, check=True,
    )
    pods = json.loads(result.stdout)["items"]
    return next((p["metadata"]["name"] for p in pods
                 if p["spec"].get("nodeName") == NODE_NAME
                 and p["status"].get("phase") == "Running"), None)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("gpu", "node"), default="gpu")
    args = parser.parse_args()
    label = "app=hpclab-%s-exporter-gpu-cluster" % args.kind if args.kind == "node" else "app=hpclab-gpu-exporter-gpu-cluster"
    local_port, remote_port = (19100, 9100) if args.kind == "node" else (19835, 9835)
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    while not stop.is_set():
        process = None
        try:
            pod = pod_name(label)
            if pod:
                process = subprocess.Popen(
                    [KUBECTL, "--kubeconfig", KUBECONFIG, "port-forward", "-n", "default",
                     "pod/" + pod, "%d:%d" % (local_port, remote_port), "--address", "127.0.0.1"],
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                while process.poll() is None and not stop.wait(2):
                    pass
        except (OSError, ValueError, KeyError, StopIteration, subprocess.SubprocessError):
            pass
        finally:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=4)
        stop.wait(3)


if __name__ == "__main__":
    main()
