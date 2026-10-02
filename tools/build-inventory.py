#!/usr/bin/env python3
"""Build src/data/lab-inventory.json from the lab's "HPC Device List" spreadsheet.

The spreadsheet is the inventory the lab already maintains by hand, so it stays the
source of truth; this script only normalises it into the shape the website serves.
Reachability is NOT decided here -- tools/probe-inventory.py writes that in afterwards.
"""
import json, re, sys, io, os
import openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/PKH/Downloads/HPC Device List.xlsx"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lab-inventory.raw.json")

# Rows whose Location/Owner marks them as not a compute resource.
SKIP_OWNER = ("未使用", "無人電腦堆", "後面櫃子", "非裝置")
SKIP_TYPE = {"Router", "Printer", "NAS", "IOT", "VIP", "Unknow", None, ""}

# GPU model -> (canonical name, VRAM GB, class). Anything not listed is kept as-is
# with unknown VRAM so a new card never silently disappears from the page.
GPUS = {
    "A100":            ("NVIDIA A100 40GB", 40, "datacenter"),
    "RTX 5090":        ("RTX 5090", 32, "consumer"),
    "RTX 5080":        ("RTX 5080", 16, "consumer"),
    "RTX 5070 TI":     ("RTX 5070 Ti", 16, "consumer"),
    "RTX 4090":        ("RTX 4090", 24, "consumer"),
    "RTX4090":         ("RTX 4090 Laptop", 16, "laptop"),
    "RTX4080":         ("RTX 4080 Laptop", 12, "laptop"),
    "RTX 4070 TI.S":   ("RTX 4070 Ti SUPER", 16, "consumer"),
    "RTX 4060 TI":     ("RTX 4060 Ti", 16, "consumer"),
    "RTX 3080":        ("RTX 3080", 10, "consumer"),
    "RTX 3060":        ("RTX 3060", 12, "consumer"),
    "RTX 2080 TI":     ("RTX 2080 Ti", 11, "consumer"),
    "RTX 2060":        ("RTX 2060", 6, "consumer"),
    "TITAN RTX":       ("TITAN RTX", 24, "prosumer"),
    "GTX 1080 TI":     ("GTX 1080 Ti", 11, "consumer"),
    "THOR":            ("Jetson AGX Thor", 128, "edge"),
    "GEFORCE 210":     ("GeForce 210", 1, "display-only"),
    "INTEL 內顯":      ("Intel iGPU", 0, "display-only"),
}

# CPU -> thread count. The spreadsheet records the model, not the thread count.
THREADS = {
    "Ultra 9 285K": 24, "Ultra 7 265K": 20, "Ultra 9 185H": 22,
    "i9-14900K": 32, "i9-14900HX": 32, "i9-13900K": 32, "i9-13980HX": 32,
    "i9-12900K": 24, "i9-12900KF": 24, "i9-10980XE": 36, "i9-9980XE": 36,
    "i9-9960X": 32, "i9-7920X": 24, "i7-12700": 20, "i7-14700": 28, "i7-9700": 8,
    "AMD 9950X": 32, "AMD 9950X3D": 32, "AMD 7960X": 48, "AMD 7950X": 32,
    "AMD 7700": 16, "AMD 3990X": 128, "AMD 3700X": 16, "EPYC 7302": 32,
    "AMD Threadripper 3970X (32C)": 64, "Intel i9-10980XE (18C)": 36,
    "Intel i9-9980XE (18C)": 36, "Intel i9-12900K": 24, "Intel i9-7920X (12C)": 24,
    "Intel i9-9960X (16C)": 32, "Intel i7-12700": 20, "Intel i7-14700": 28,
}

def norm_gpu(raw):
    """-> list of {model, vramGB, class, passthrough} for one spreadsheet cell."""
    if not raw: return []
    s = str(raw).strip()
    if s in ("-", "N/A", ""): return []
    passthrough = bool(re.search(r"直通|vfio|passthrough", s, re.I))
    display_only = bool(re.search(r"僅顯示|內顯", s))
    base = re.sub(r"\(.*?\)", "", s).strip()
    key = base.upper()
    name, vram, cls = GPUS.get(key, (base, None, "unknown"))
    if display_only: cls = "display-only"
    return [{"model": name, "vramGB": vram, "class": cls, "passthrough": passthrough}]

def norm_ram(raw):
    if not raw: return None
    m = re.search(r"(\d+)", str(raw))
    return int(m.group(1)) if m else None

def norm_threads(cpu):
    if not cpu: return None
    s = str(cpu).strip()
    if s in THREADS: return THREADS[s]
    m = re.match(r"(\d+)\s*vCPU", s, re.I)
    if m: return int(m.group(1))
    for k, v in THREADS.items():
        if k.lower() in s.lower(): return v
    return None

def norm_ip(raw):
    if not raw: return None
    s = str(raw).strip()
    m = re.fullmatch(r"(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})", s)
    if not m: return None
    # 172.2.23.149 in the sheet is a typo for the ST312 172.23.2.0/24 subnet
    if s == "172.2.23.149": return "172.23.2.149"
    return s

# Hand corrections for rows the spreadsheet leaves blank or records loosely.
OVERRIDES = {
    "140.128.103.193": {"cpu": "Arm Neoverse-V3AE 14C", "cpuThreads": 14, "type": "Edge",
                        "gpus": [{"model": "Jetson AGX Thor", "vramGB": 128, "class": "edge", "passthrough": False}]},
    "172.24.12.78": {"cpu": "Arm Cortex-A78AE 6C", "cpuThreads": 6, "ramGB": 8,
                     "gpus": [{"model": "Jetson Orin Nano (1024-core Ampere)", "vramGB": 8, "class": "edge", "passthrough": False}]},
    "172.24.12.69": {"cpu": "NVIDIA Carmel 6C", "cpuThreads": 6, "ramGB": 8,
                     "gpus": [{"model": "Jetson Xavier NX (384-core Volta)", "vramGB": 8, "class": "edge", "passthrough": False}]},
}
VIRTUAL_TYPES = {"VM", "Virtual"}

# A machine that was re-cabled onto the cluster network answers on a new address;
# the spreadsheet still lists the old one. Keyed old -> new.
READDRESSED = {
    "140.128.103.173": "172.24.13.84",   # PK i9-14900K / RTX 3060 -> gpu-cluster node pk-3060
}

# Nodes that exist in the cluster but were never entered in the spreadsheet.
EXTRAS = [
    {"ip": "172.24.12.85", "label": "pk-5090", "owner": "PK", "type": "Server",
     "location": "ST429", "section": "ST429", "cpu": "20T", "cpuThreads": 20, "ramGB": 32,
     "os": "Ubuntu 24.04", "asset": "", "row": None, "powerW": None,
     "gpus": [{"model": "RTX 5090", "vramGB": 32, "class": "consumer", "passthrough": False}]},
]

def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Device List"]
    rows = list(ws.iter_rows(values_only=True))
    machines, section = [], ""
    for idx, r in enumerate(rows[1:], start=2):
        r = list(r) + [None] * 32
        ip, app, owner, typ, loc, cpu, ram, gpu, disk, watt, osv, asset, note = r[:13]
        ssh_hint = r[12]
        txt = lambda v: ("" if v is None else str(v).strip())
        app, owner, typ, loc = txt(app), txt(owner), txt(typ), txt(loc)
        # section header rows: only the Application column is filled
        if app and not any([ip, owner, typ, loc, cpu, ram, gpu]):
            section = app
            continue
        if typ in SKIP_TYPE: continue
        if any(k in owner for k in SKIP_OWNER) or any(k in app for k in SKIP_OWNER): continue
        gpus = norm_gpu(gpu)
        threads, ramgb = norm_threads(cpu), norm_ram(ram)
        if not gpus and not threads and not ramgb and typ not in ("Edge",): continue
        # SSH hint column sometimes carries the only known IP for ST430 boxes
        host_ip = norm_ip(ip)
        if not host_ip and ssh_hint:
            m = re.search(r"@(\d{1,3}(?:\.\d{1,3}){3})", str(ssh_hint))
            if m: host_ip = m.group(1)
        entry = {
            "row": idx,
            "ip": host_ip,
            "asset": txt(asset),
            "label": app or owner or (txt(gpu) + " 工作站") or "未命名裝置",
            "owner": owner,
            "type": typ,
            "location": loc or section,
            "section": section,
            "cpu": txt(cpu) or None,
            "cpuThreads": threads,
            "ramGB": ramgb,
            "gpus": gpus,
            "os": txt(osv) or None,
            "powerW": float(watt) if isinstance(watt, (int, float)) else None,
        }
        entry.update(OVERRIDES.get(host_ip or "", {}))
        if host_ip in READDRESSED:
            entry["ip"] = READDRESSED[host_ip]
            entry["previousIp"] = host_ip
        # Guest VMs run on hardware already listed above them, so they must not be
        # added into the physical CPU / RAM / GPU totals.
        entry["virtual"] = entry["type"] in VIRTUAL_TYPES
        machines.append(entry)
    for e in EXTRAS:
        e = dict(e)
        e["virtual"] = e["type"] in VIRTUAL_TYPES
        machines.append(e)
    data = {"source": "HPC Device List.xlsx", "machines": machines}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("wrote %d machines -> %s" % (len(machines), os.path.normpath(OUT)))

main()
