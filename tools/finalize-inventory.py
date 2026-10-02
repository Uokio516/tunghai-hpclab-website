#!/usr/bin/env python3
"""Merge the parsed spreadsheet with the reachability probe into the file the
website actually serves: lab-inventory.default.json at the repo root.

Policy (from the lab):
  * every machine that can be reached is shown;
  * machines that answer nothing have been physically relocated, so they are
    carried in the file with include=false and never rendered;
  * guest VMs and display-only cards never count toward the capacity totals,
    because the card they expose is the host's and would be counted twice.
"""
import json, io, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
INV = os.path.join(ROOT, "tools", "data", "lab-inventory.raw.json")
REACH = os.path.join(ROOT, "tools", "data", "lab-reachability.json")
OUT = os.path.join(ROOT, "lab-inventory.default.json")

GROUPS = {
    "LIB Server Room": ("lib", "圖書館機房"),
    "LIB Corridor":    ("lib", "圖書館機房"),
    "ST312":           ("st312", "ST312 研究室"),
    "ST429":           ("st429", "ST429 研究室"),
    "ST430":           ("st430", "ST430 機房"),
    "Office":          ("office", "辦公室"),
}
# ST430 holds both the cluster hardware and members' workstations; split them so
# the page can show "叢集實體節點" apart from "個人工作站".
CLUSTER_TYPES = {"Server"}

def main():
    inv = json.load(io.open(INV, encoding="utf-8"))
    reach = json.load(io.open(REACH, encoding="utf-8"))
    hosts = reach["hosts"]

    out = []
    for i, m in enumerate(inv["machines"], 1):
        ip = m.get("ip")
        r = hosts.get(ip) if ip else None
        reachable = bool(r and r["reachable"])
        gid, gname = GROUPS.get(m["location"], ("other", m["location"] or "其他"))
        if gid == "st430" and m["type"] in CLUSTER_TYPES:
            gid, gname = "cluster", "叢集實體節點"
        real_gpus = [g for g in m["gpus"] if g["class"] not in ("display-only", "edge")]
        out.append({
            "id": "inv-%02d" % i,
            "ip": ip,
            "label": m["label"],
            "owner": m["owner"],
            "type": m["type"],
            "os": m["os"],
            "location": m["location"],
            "group": gid,
            "groupName": gname,
            "cpu": m["cpu"],
            "cpuThreads": m["cpuThreads"],
            "ramGB": m["ramGB"],
            "gpus": m["gpus"],
            "virtual": m["virtual"],
            "reachable": reachable,
            # Ports that answered during the sweep. The server re-probes these at
            # runtime so the page shows live up/down rather than a frozen verdict.
            "ports": (r or {}).get("ports", []),
            # No IP recorded at all means the sheet never had one; those boxes are
            # the ones that were moved and re-cabled, so they stay hidden too.
            "include": reachable,
            "excludeReason": None if reachable else ("relocated" if ip else "no-address"),
            "countsForCapacity": reachable and not m["virtual"] and bool(real_gpus or m["cpuThreads"]),
            "edge": m["type"] == "Edge",
        })

    counted = [m for m in out if m["countsForCapacity"] and not m["edge"]]
    edge = [m for m in out if m["include"] and m["edge"]]
    by_model = {}
    for m in counted:
        for g in m["gpus"]:
            if g["class"] in ("display-only", "edge"):
                continue
            e = by_model.setdefault(g["model"], {"model": g["model"], "count": 0, "vramGB": g["vramGB"], "class": g["class"]})
            e["count"] += 1
    gpus = sorted(by_model.values(), key=lambda e: (-(e["vramGB"] or 0), e["model"]))
    totals = {
        "machines": len(counted),
        "gpus": sum(e["count"] for e in gpus),
        "vramGB": sum((e["vramGB"] or 0) * e["count"] for e in gpus),
        "cpuThreads": sum(m["cpuThreads"] or 0 for m in counted),
        "ramGB": sum(m["ramGB"] or 0 for m in counted),
        "hidden": sum(1 for m in out if not m["include"]),
        "edgeDevices": len(edge),
    }
    data = {
        "updatedAt": datetime.date.today().isoformat(),
        "probedAt": reach["probedAt"],
        "source": "inventory",
        "totals": totals,
        "gpuModels": gpus,
        "machines": out,
    }
    json.dump(data, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("wrote", OUT)
    for k, v in totals.items(): print("  %-12s %s" % (k, v))
    print()
    for e in gpus: print("  %-22s x%-3d %sGB" % (e["model"], e["count"], e["vramGB"]))

main()
