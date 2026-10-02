#!/usr/bin/env python3
"""Read-only nvidia-smi XML and MIG metadata exporter; no GPU management calls.

NVIDIA documents -q -x and -L at https://docs.nvidia.com/deploy/nvidia-smi/
MIG profile listings: https://docs.nvidia.com/datacenter/tesla/mig-user-guide/getting-started-with-mig.html
Verified XML paths: https://github.com/ceems-dev/ceems/blob/main/pkg/collector/gpu.go
No capacities or SM counts are inferred from a GPU/profile name.
"""

import argparse
import re
import shutil
import subprocess
import time
import xml.etree.ElementTree as ET
from telemetry_common import (Snapshot, integer, memory_bytes, metric_labels, number,
                              output_once, serve, validate_args)


def parse_listing(text):
    devices = {}
    parent = None
    for line in text.splitlines():
        gpu = re.fullmatch(r"GPU (\d+): (.+) \(UUID: (GPU-[A-Za-z0-9-]+)\)\s*", line)
        if gpu:
            parent = gpu.group(3)
            devices[parent] = {"index": gpu.group(1), "name": gpu.group(2), "slices": {}}
            continue
        part = re.fullmatch(r"\s+MIG (\S+) Device (\d+): \(UUID: (MIG-[A-Za-z0-9_/-]+)\)\s*", line)
        if part and parent:
            devices[parent]["slices"][int(part.group(2))] = {
                "profile": part.group(1), "uuid": part.group(3),
            }
    return devices


def first_value(node, paths, parse):
    for path in paths:
        value = parse(node.findtext(path))
        if value is not None:
            return value
    return None


def parse_xml(xml_text, listing_text):
    # ElementTree never downloads the external NVIDIA DTD. Reject custom entities.
    if "<!ENTITY" in xml_text.upper() or len(xml_text) > 8 * 1024 * 1024:
        raise ValueError("untrusted or oversized XML")
    root = ET.fromstring(xml_text)
    if root.tag != "nvidia_smi_log":
        raise ValueError("unexpected XML document")
    listings = parse_listing(listing_text)
    gpus = []
    for node in root.findall("gpu"):
        uuid = node.findtext("uuid", "").strip()
        listed = listings.get(uuid)
        if not listed:
            # A topology change between the two reads cannot safely be joined by ordinal.
            raise ValueError("GPU identity changed between reads")
        mode = node.findtext("mig_mode/current_mig", "").strip().lower()
        slices = []
        for part in node.findall("mig_devices/mig_device"):
            index = integer(part.findtext("index"))
            metadata = listed["slices"].get(index, {})
            gi = integer(part.findtext("gpu_instance_id"))
            ci = integer(part.findtext("compute_instance_id"))
            if index is None or gi is None or ci is None:
                raise ValueError("MIG identity unavailable")
            xml_uuid = part.findtext("uuid", "").strip() or None
            if xml_uuid and metadata.get("uuid") and xml_uuid != metadata["uuid"]:
                raise ValueError("MIG identity changed between reads")
            slices.append({
                "index": index, "giId": gi, "ciId": ci,
                "uuid": xml_uuid or metadata.get("uuid"),
                "profile": metadata.get("profile"),
                "sm": integer(part.findtext("device_attributes/shared/multiprocessor_count")),
                "memUsed": memory_bytes(part.findtext("fb_memory_usage/used")),
                "memTotal": memory_bytes(part.findtext("fb_memory_usage/total")),
            })
        # -L can report a device for which XML omits measurement data. Retain only
        # the actual profile/UUID; unknown GI, CI, SM and capacity stay null.
        known_indices = {part["index"] for part in slices}
        for index, metadata in listed["slices"].items():
            if index not in known_indices:
                slices.append(dict(index=index, giId=None, ciId=None, sm=None,
                                   memUsed=None, memTotal=None, **metadata))
        slices.sort(key=lambda part: part["index"])
        mig_enabled = mode == "enabled" or bool(slices)
        # An absent/unknown MIG status is not proof that utilization is supported.
        raw_util = number(node.findtext("utilization/gpu_util"), maximum=100)
        available = mode == "disabled" and raw_util is not None and not mig_enabled
        gpu = {
            "index": listed["index"], "uuid": uuid,
            "name": node.findtext("product_name", listed["name"]).strip(),
            "driver": root.findtext("driver_version", "").strip() or None,
            "migEnabled": mig_enabled if mode in ("enabled", "disabled") or slices else None,
            "util": raw_util / 100 if available else None, "utilAvailable": available,
            "utilUnavailableReason": None if available else ("mig-enabled" if mig_enabled else "unsupported"),
            "memUsed": memory_bytes(node.findtext("fb_memory_usage/used")),
            "memTotal": memory_bytes(node.findtext("fb_memory_usage/total")),
            "temp": number(node.findtext("temperature/gpu_temp")),
            "power": first_value(node, ("gpu_power_readings/instant_power_draw", "gpu_power_readings/power_draw",
                                         "power_readings/power_draw"), number),
            "powerLimit": first_value(node, ("gpu_power_readings/current_power_limit", "gpu_power_readings/power_limit",
                                              "power_readings/power_limit"), number),
            "migSlices": slices,
            "migProfile": " + ".join(part["profile"] for part in slices if part.get("profile")) or None,
        }
        gpus.append(gpu)
    if not gpus:
        raise ValueError("no GPUs in XML")
    return {"source": "nvidia-smi-xml", "gpus": gpus}


class Collector:
    def __init__(self, binary, machine_id, interval=5, timeout=2):
        self.binary = binary
        self.timeout = timeout
        self.snapshot = Snapshot(machine_id, interval, "nvidia_smi")

    def collect(self):
        started = time.monotonic()
        payload = None
        try:
            def read(arguments):
                result = subprocess.run([self.binary] + arguments, stdin=subprocess.DEVNULL,
                                        capture_output=True, text=True, timeout=self.timeout,
                                        check=False, env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LC_ALL": "C"})
                if result.returncode:
                    raise ValueError("GPU read failed")
                return result.stdout
            payload = parse_xml(read(["-q", "-x"]), read(["-L"]))
        except (OSError, ValueError, ET.ParseError, subprocess.TimeoutExpired):
            pass  # Failure status only: never return stderr or process metadata.
        self.snapshot.update(payload, time.monotonic() - started)

    def metrics(self):
        data = self.snapshot.data()
        rows = self.snapshot.status_metrics()
        for gpu in data["gpus"]:
            identity = metric_labels({"index": gpu["index"], "uuid": gpu["uuid"]})
            rows.append("nvidia_smi_gpu_info%s 1" % metric_labels({"index": gpu["index"], "uuid": gpu["uuid"],
                         "name": gpu["name"], "gpu": gpu["name"], "driver_version": gpu.get("driver")}))
            rows.append("nvidia_smi_utilization_available%s %d" % (identity, gpu["utilAvailable"]))
            if not data["collectionSuccess"]:
                continue
            rows.append("nvidia_smi_sample_timestamp_seconds%s %.6f" % (identity, self.snapshot.last_success))
            if gpu["migEnabled"] is not None:
                rows.append("nvidia_smi_mig_enabled%s %d" % (identity, gpu["migEnabled"]))
            for key, metric, scale in (
                ("util", "utilization_gpu_ratio", 1), ("memUsed", "memory_used_bytes", 1),
                ("memTotal", "memory_total_bytes", 1), ("temp", "temperature_gpu", 1),
                ("power", "power_draw_watts", 1), ("powerLimit", "power_limit_watts", 1),
            ):
                if gpu.get(key) is not None:
                    rows.append("nvidia_smi_%s%s %.12g" % (metric, identity, gpu[key] * scale))
            for part in gpu["migSlices"]:
                label = metric_labels({"index": gpu["index"], "uuid": gpu["uuid"], "mig_index": part["index"],
                                       "gi_id": part["giId"], "ci_id": part["ciId"], "profile": part["profile"],
                                       "mig_uuid": part.get("uuid")})
                rows.append("nvidia_smi_mig_info%s 1" % label)
                for key, suffix in (("sm", "sm_count"), ("memUsed", "memory_used_bytes"), ("memTotal", "memory_total_bytes")):
                    if part.get(key) is not None:
                        rows.append("nvidia_smi_mig_%s%s %.12g" % (suffix, label, part[key]))
        return "\n".join(rows) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", required=True)
    parser.add_argument("--listen", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9401)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--timeout", type=float, default=2)
    parser.add_argument("--binary", default=shutil.which("nvidia-smi"))
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--format", choices=("json", "metrics"), default="metrics")
    args = parser.parse_args()
    validate_args(parser, args)
    if not args.binary:
        parser.exit(2, "nvidia-smi not found; this tool never installs drivers.\n")
    collector = Collector(args.binary, args.id, args.interval, args.timeout)
    if args.once:
        return output_once(collector, args.format)
    serve(collector, args.listen, args.port, args.interval)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
