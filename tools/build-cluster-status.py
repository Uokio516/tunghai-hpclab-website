#!/usr/bin/env python3
"""Build cluster-status.default.json: the snapshot /api/cluster-status serves.

Takes the previous snapshot as the base (it carries Ceph/PBS/VM detail that is not
derivable from anywhere else), adds the gpu-cluster section from a live
`kubectl get nodes -o json` capture, and recomputes the headline summary from the
device inventory so the numbers stop drifting from reality.

  python tools/build-cluster-status.py          # rewrite cluster-status.default.json
"""
import json, io, os, datetime

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BASE = os.path.join(ROOT, "cluster-status.default.json")
NODES = os.path.join(ROOT, "tools", "data", "gpu-cluster-nodes.json")
INV = os.path.join(ROOT, "lab-inventory.default.json")

# gpu-cluster node -> the physical card behind it. Kubernetes reports a count, not a
# model, because the cluster has no DCGM exporter yet.
CARDS = {
    "pk-gpu-cc1": ("RTX 2080 Ti", "cc1 vfio 直通"),
    "pk-gpu-cc2": ("RTX 2080 Ti", "cc2 vfio 直通"),
    "pk-gpu-cc3": ("RTX 3060", "cc3 vfio 直通"),
    "pk-gpu-pve3": ("RTX 2060", "pve3 直通"),
    "pk-gpu-pve4": ("RTX 2080 Ti", "pve4 直通"),
    "pk-3060": ("RTX 3060", "裸機節點"),
    "pk-5090": ("RTX 5090", "裸機節點"),
}

def gib(ki): return round(int(str(ki).rstrip("Ki")) / 1048576, 1)

def gpu_cluster_section():
    d = json.load(io.open(NODES, encoding="utf-8"))
    nodes, gpus, cpu, mem = [], 0, 0, 0.0
    for n in sorted(d["items"], key=lambda x: x["metadata"]["name"]):
        m, st, sp = n["metadata"], n["status"], n.get("spec", {})
        ready = next((c["status"] for c in st["conditions"] if c["type"] == "Ready"), "Unknown") == "True"
        cap = st["capacity"]
        g = int(cap.get("nvidia.com/gpu", 0) or 0)
        card, how = CARDS.get(m["name"], ("GPU", ""))
        control = m.get("labels", {}).get("node-role.kubernetes.io/control-plane") == "true"
        taints = [t["key"] for t in (sp.get("taints") or [])]
        gpus += g; cpu += int(cap["cpu"]); mem += gib(cap["memory"])
        nodes.append({
            "name": m["name"],
            "role": " · ".join(filter(None, [
                "control-plane" if control else "worker",
                how,
                ("taint " + ",".join(taints)) if taints else "",
            ])),
            "status": "up" if ready else "down",
            "cpu": f"{cap['cpu']}T",
            "ram": f"{gib(cap['memory'])} GiB",
            "gpu": card if g else None,
            "gpuLevel": "active" if g else None,
        })
    kubelet = d["items"][0]["status"]["nodeInfo"]["kubeletVersion"]
    ready_n = sum(1 for n in nodes if n["status"] == "up")
    return {
        "id": "gpu-cluster",
        "name": "GPU 運算叢集",
        "subtitle": "gpu-cluster",
        "accent": "#76b900",
        "stack": f"RKE2 {kubelet} · NVIDIA device plugin · 5 直通 VM + 2 裸機節點",
        "status": f"{ready_n}/{len(nodes)} Ready",
        "statusLevel": "good" if ready_n == len(nodes) else "warn",
        "quick": [
            {"v": str(len(nodes)), "l": "節點"},
            {"v": str(gpus), "l": "可排程 GPU"},
            {"v": str(cpu), "l": "CPU 執行緒"},
            {"v": f"{round(mem)} GiB", "l": "記憶體"},
            {"v": "2", "l": "裸機節點"},
        ],
        "nodes": nodes,
        "meters": [
            {"label": "節點 Ready", "value": f"{ready_n} / {len(nodes)}", "pct": round(ready_n / len(nodes) * 100), "level": "good"},
            {"label": "GPU 已註冊", "value": f"{gpus} / {len(nodes)}", "pct": round(gpus / len(nodes) * 100), "level": "accent"},
        ],
        "services": [
            "排程 · Kubernetes nvidia.com/gpu resource",
            "執行階段 · NVIDIA Container Toolkit",
            "待辦 · DCGM exporter 尚未部署，GPU 使用率無法即時回報",
        ],
    }, gpus, cpu, round(mem)

def main():
    base = json.load(io.open(BASE, encoding="utf-8"))
    inv = json.load(io.open(INV, encoding="utf-8"))
    section, gpus, cpu, mem = gpu_cluster_section()

    clusters = [c for c in base["clusters"] if c["id"] != "gpu-cluster"]
    # gpu-cluster first: it is the thing the lab is actually asked about.
    clusters.insert(0, section)

    # cc3's card is in the cluster now, so it is no longer "待裝".
    for c in clusters:
        if c["id"] == "cubecos":
            for n in c["nodes"]:
                if n["name"] == "cc3":
                    n["gpu"], n["gpuLevel"] = "RTX 3060 · 直通 gpu-cluster", "active"
            c["quick"] = [q if q["l"] != "GPU 直通" else {"v": "2× 2080 Ti · 1× 3060", "l": "GPU 直通"} for q in c["quick"]]

    # Physical estate: the server-class machines in the inventory, counted once.
    phys = [m for m in inv["machines"] if m["group"] == "cluster" and m["countsForCapacity"]]
    phys_gpus = sum(1 for m in phys for g in m["gpus"] if g["class"] not in ("display-only", "edge"))

    base["clusters"] = clusters
    base["updatedAt"] = datetime.date.today().isoformat()
    base["source"] = "collector"
    base["summary"].update({
        "physicalNodes": len(phys),
        "cpuThreads": sum(m["cpuThreads"] or 0 for m in phys),
        "memoryGB": sum(m["ramGB"] or 0 for m in phys),
        "gpus": gpus,
        "gpusPending": 1,
        "platforms": 4,
        "notes": {
            "physicalNodes": "3 CubeCOS · 7 Proxmox · PBS · 借用",
            "cpuThreads": "機房實體節點合計",
            "memoryGB": f"TB · ≈ {sum(m['ramGB'] or 0 for m in phys):,} GB",
            "gpus": f"gpu-cluster 可排程 · 實體卡 {phys_gpus} 張 · A100 待加入",
            "cephTiB": "TiB · +PBS 5.7 TB",
            "vms": "運行 / 總數",
            "platforms": "OpenStack · PVE · PBS · RKE2",
        },
    })
    json.dump(base, io.open(BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("wrote", BASE)
    for k, v in base["summary"].items():
        if k != "notes": print("  %-14s %s" % (k, v))
    print("  clusters      " + ", ".join(c["id"] for c in clusters))

main()
