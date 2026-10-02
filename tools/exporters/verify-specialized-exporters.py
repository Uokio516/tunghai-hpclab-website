#!/usr/bin/env python3
"""Offline fixture checks; never contact a lab machine or call a vendor binary."""

import json
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
from jetson_exporter import cpu_util, parse_tegrastats, read_proc
from mig_telemetry import Collector, parse_listing, parse_xml
from telemetry_common import Snapshot


# Small synthetic XML uses vendor/CEEMS-observed tag names. Values and UUIDs
# are fixtures and are never exposed by the production exporter.
XML = """<?xml version="1.0"?>
<!DOCTYPE nvidia_smi_log SYSTEM "nvsmi_device_v12.dtd">
<nvidia_smi_log><driver_version>580.fixture</driver_version><gpu>
<uuid>GPU-fixture</uuid><product_name>NVIDIA A100-PCIE-40GB</product_name>
<mig_mode><current_mig>Enabled</current_mig></mig_mode>
<fb_memory_usage><total>40960 MiB</total><used>249 MiB</used></fb_memory_usage>
<temperature><gpu_temp>41 C</gpu_temp></temperature>
<gpu_power_readings><instant_power_draw>40.71 W</instant_power_draw><current_power_limit>250 W</current_power_limit></gpu_power_readings>
<utilization><gpu_util>100 %</gpu_util></utilization>
<mig_devices><mig_device><index>0</index><gpu_instance_id>1</gpu_instance_id><compute_instance_id>0</compute_instance_id>
<device_attributes><shared><multiprocessor_count>42</multiprocessor_count></shared></device_attributes>
<fb_memory_usage><total>20096 MiB</total><used>107 MiB</used></fb_memory_usage>
</mig_device><mig_device><index>1</index><gpu_instance_id>5</gpu_instance_id><compute_instance_id>0</compute_instance_id>
<fb_memory_usage><total>N/A</total><used>N/A</used></fb_memory_usage></mig_device></mig_devices>
</gpu></nvidia_smi_log>"""
LISTING = "GPU 0: NVIDIA A100-PCIE-40GB (UUID: GPU-fixture)\n  MIG 3g.20gb Device 0: (UUID: MIG-fixture-0)\n  MIG 2g.10gb Device 1: (UUID: MIG-fixture-1)\n"


class ExporterChecks(unittest.TestCase):
    def test_mig_real_values_and_unsupported_utilization(self):
        gpu = parse_xml(XML, LISTING)["gpus"][0]
        self.assertTrue(gpu["migEnabled"])
        self.assertIsNone(gpu["util"])
        self.assertFalse(gpu["utilAvailable"])
        self.assertEqual(gpu["memTotal"], 40960 * 1024 ** 2)
        self.assertEqual(gpu["power"], 40.71)
        self.assertEqual(gpu["migSlices"][0]["profile"], "3g.20gb")
        self.assertEqual(gpu["migSlices"][0]["sm"], 42)
        self.assertEqual(gpu["migSlices"][0]["memUsed"], 107 * 1024 ** 2)
        self.assertIsNone(gpu["migSlices"][1]["memTotal"])
        self.assertIsNone(gpu["migSlices"][1]["sm"])

    def test_mig_missing_xml_measurement_does_not_guess_capacity_or_ids(self):
        listing = LISTING + "  MIG 1g.5gb Device 2: (UUID: MIG-fixture-2)\n"
        part = parse_xml(XML, listing)["gpus"][0]["migSlices"][2]
        self.assertEqual(part["profile"], "1g.5gb")
        for field in ("memUsed", "memTotal", "giId", "ciId", "sm"):
            self.assertIsNone(part[field])

    def test_xml_missing_gpu_and_entities_fail_closed(self):
        with self.assertRaises(ValueError):
            parse_xml(XML, LISTING.replace("GPU-fixture", "GPU-changed"))
        with self.assertRaises(ValueError):
            parse_xml(XML.replace("<!DOCTYPE", '<!ENTITY fixture "bad"><!DOCTYPE'), LISTING)

    def test_mig_legacy_uuid_profile_listing(self):
        parsed = parse_listing("GPU 2: A100 (UUID: GPU-fixture)\n  MIG 7g.40gb Device 0: (UUID: MIG-GPU-fixture/0/0)\n")
        self.assertEqual(parsed["GPU-fixture"]["slices"][0]["profile"], "7g.40gb")

    def test_failure_and_age_remove_measurements_preserve_last_success(self):
        snapshot = Snapshot("fixture", 5, "nvidia_smi")
        with patch("telemetry_common.time.time", return_value=100):
            snapshot.update(parse_xml(XML, LISTING), .1)
        with patch("telemetry_common.time.time", return_value=101):
            first = snapshot.data()
            self.assertTrue(first["collectionSuccess"])
            snapshot.update(None, .1)
            failed = snapshot.data()
        self.assertFalse(failed["collectionSuccess"])
        self.assertEqual(failed["lastSuccessAt"], first["lastSuccessAt"])
        self.assertIsNone(failed["gpus"][0]["memUsed"])
        self.assertIsNone(failed["gpus"][0]["migSlices"][0]["memUsed"])
        with patch("telemetry_common.time.time", return_value=102):
            snapshot.update(parse_xml(XML, LISTING), .1)
            self.assertTrue(snapshot.data()["collectionSuccess"])
        with patch("telemetry_common.time.time", return_value=120):
            self.assertFalse(snapshot.data()["collectionSuccess"])

    def test_mig_metrics_never_emit_utilization_for_mig(self):
        collector = Collector("unused", "fixture")
        collector.snapshot.update(parse_xml(XML, LISTING), .1)
        metrics = collector.metrics()
        self.assertNotIn("nvidia_smi_utilization_gpu_ratio", metrics)
        self.assertIn("nvidia_smi_mig_memory_used_bytes", metrics)
        collector.snapshot.update(None, .1)
        self.assertNotIn("nvidia_smi_mig_memory_used_bytes", collector.metrics())

    def test_jetson_activation_shared_memory_and_dedicated_power(self):
        payload = parse_tegrastats("RAM 123/4096MB CPU [1%@102,off] GR3D_FREQ 37%@921 GPU@45.5C VDD_GPU 1800mW/1700mW")
        gpu = payload["gpus"][0]
        self.assertEqual(gpu["util"], .37)
        self.assertEqual(gpu["temp"], 45.5)
        self.assertEqual(gpu["power"], 1.8)
        self.assertTrue(gpu["memoryShared"])
        self.assertIsNone(gpu["memTotal"])
        self.assertIsNone(gpu["memUsed"])
        self.assertEqual(payload["sharedMemory"]["total"], 4096 * 1024 ** 2)
        self.assertEqual(json.loads(json.dumps(payload))["gpus"][0]["util"], .37)

    def test_jetson_missing_or_invalid_util_is_not_zero(self):
        payload = parse_tegrastats("RAM 123/4096MB GR3D_FREQ @[1098,1098] VDD_CPU_GPU_CV 5000mW/3000mW")
        gpu = payload["gpus"][0]
        self.assertIsNone(gpu["util"])
        self.assertFalse(gpu["utilAvailable"])
        self.assertIsNone(gpu["power"])
        payload = parse_tegrastats("RAM 123/4096MB GR3D_FREQ 101%")
        self.assertIsNone(payload["gpus"][0]["util"])
        with self.assertRaises(ValueError):
            parse_tegrastats("permission error")

    def test_proc_cpu_delta_memory_and_counter_reset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "meminfo").write_text("MemTotal: 4096 kB\nMemAvailable: 2048 kB\n", encoding="ascii")
            (root / "stat").write_text("cpu 10 0 10 70 10 0 0 0\ncpu0 10 0 10 70 10 0 0 0\n", encoding="ascii")
            proc = read_proc(directory)
            self.assertEqual(proc["memAvailable"], 2048 * 1024)
            self.assertAlmostEqual(cpu_util([0] * 8, proc["counters"]["cpu"]), 20)
            self.assertIsNone(cpu_util(None, proc["counters"]["cpu"]))
            self.assertIsNone(cpu_util([20] * 8, proc["counters"]["cpu"]))

    def test_http_json_metrics_health_use_cached_fixture_only(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        runner = (
            "from mig_telemetry import Collector, parse_xml\n"
            "from telemetry_common import serve\n"
            "collector = Collector('never-executed', 'fixture', interval=2)\n"
            "collector.collect = lambda: collector.snapshot.update(parse_xml(%r, %r), .001)\n"
            "serve(collector, '127.0.0.1', %d, 2)\n"
        ) % (XML, LISTING, port)
        process = subprocess.Popen([sys.executable, "-B", "-c", runner],
                                   cwd=Path(__file__).parent, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        endpoint = "http://127.0.0.1:%d" % port
        try:
            for attempt in range(30):
                try:
                    response = urllib.request.urlopen(endpoint + "/telemetry", timeout=1)
                    payload = json.load(response)
                    if payload["collectionSuccess"]:
                        break
                except OSError:
                    if process.poll() is not None:
                        self.fail("fixture HTTP process stopped: " + process.stderr.read().decode())
                time.sleep(.05)
            else:
                self.fail("fixture HTTP server did not become ready")
            self.assertIsNone(payload["gpus"][0]["util"])
            self.assertTrue(payload["sampledAt"].endswith("Z"))
            self.assertNotIn("ip", payload)
            metrics = urllib.request.urlopen(endpoint + "/metrics", timeout=1).read().decode()
            self.assertIn("nvidia_smi_mig_memory_used_bytes", metrics)
            self.assertNotIn("nvidia_smi_utilization_gpu_ratio", metrics)
            self.assertEqual(urllib.request.urlopen(endpoint + "/health", timeout=1).status, 200)
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(endpoint + "/other", timeout=1)
            self.assertEqual(error.exception.code, 404)
        finally:
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
