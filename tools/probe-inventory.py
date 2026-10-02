#!/usr/bin/env python3
"""Probe every inventory IP and record whether it is reachable right now.

Machines that have been physically moved answer nothing; the website hides those
rather than showing a permanently dead card. Probing is read-only: one ICMP echo
plus a TCP connect to a few common ports. Nothing is logged into and nothing is
changed on the target.
"""
import json, io, os, re, socket, subprocess, sys, datetime
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
INV = os.path.join(HERE, "data", "lab-inventory.raw.json")
OUT = os.path.join(HERE, "data", "lab-reachability.json")
PORTS = [22, 30678, 80, 443, 8006, 9100, 9835]

def tcp(ip, port, timeout=1.2):
    try:
        with socket.create_connection((ip, port), timeout):
            return True
    except OSError:
        return False

def icmp(ip):
    cmd = ["ping", "-n", "1", "-w", "1500", ip] if os.name == "nt" else ["ping", "-c", "1", "-W", "2", ip]
    try:
        return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8).returncode == 0
    except Exception:
        return False

def probe(ip):
    ping = icmp(ip)
    open_ports = [p for p in PORTS if tcp(ip, p)]
    return {"ip": ip, "ping": ping, "ports": open_ports, "reachable": ping or bool(open_ports)}

def main():
    inv = json.load(io.open(INV, encoding="utf-8"))
    ips = sorted({m["ip"] for m in inv["machines"] if m.get("ip")})
    with ThreadPoolExecutor(max_workers=24) as ex:
        results = list(ex.map(probe, ips))
    data = {
        "probedAt": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "hosts": {r["ip"]: r for r in results},
    }
    json.dump(data, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    up = [r for r in results if r["reachable"]]
    print("reachable %d / %d" % (len(up), len(results)))
    for r in results:
        print("  %-16s %-4s %s" % (r["ip"], "UP" if r["reachable"] else "DOWN",
                                   ("ping " if r["ping"] else "") + ",".join(map(str, r["ports"]))))

main()
