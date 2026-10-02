#!/usr/bin/env python3
"""Offline push-client checks with mock HTTP only; no lab or public connection."""

import contextlib
import http.client
import io
import json
import os
import stat
import tempfile
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from push_telemetry import (Client, ConfigError, MAX_METRICS_BYTES, NoRedirect,
                            load_config, main, parse_config)


CONFIG = {
    "machineId": "inventory-fixture",
    "endpoint": "https://example.invalid/api/internal/exporter-telemetry",
    "token": "offline-fixture-token",
    "nodeUrl": "http://127.0.0.1:9100/metrics",
    "nvidiaUrl": "http://127.0.0.1:9835/metrics",
}
GPU_METRICS = b'nvidia_smi_utilization_gpu_ratio{index="0"} 0.37\nnvidia_smi_last_success_timestamp_seconds 1234.5\n'


class Response:
    def __init__(self, body=b"", code=200):
        self.body = body
        self.code = code
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def read(self, size=-1):
        return self.body if size < 0 else self.body[:size]
    def getcode(self):
        return self.code


class Opener:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = []
    def open(self, request, timeout):
        self.calls.append((request, timeout))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class PushChecks(unittest.TestCase):
    def test_https_endpoint_local_source_id_and_token_validation(self):
        self.assertEqual(len(parse_config(CONFIG)["targets"]), 2)
        cases = [
            {"endpoint": "http://example.invalid/api/internal/exporter-telemetry"},
            {"endpoint": "https://user:password@example.invalid/api/internal/exporter-telemetry"},
            {"endpoint": CONFIG["endpoint"] + "?token=fixture"},
            {"nodeUrl": "http://example.invalid/metrics"},
            {"nodeUrl": "file:///metrics"},
            {"machineId": "invalid/id"},
            {"token": "invalid\ntoken"},
        ]
        for replacement in cases:
            with self.subTest(fields=tuple(replacement)):
                with self.assertRaises(ConfigError):
                    parse_config(dict(CONFIG, **replacement))

    def test_load_private_config_and_reject_0644_without_disclosing_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "private.json"
            path.write_text(json.dumps(CONFIG), encoding="utf-8")
            os.chmod(path, 0o600)
            self.assertEqual(load_config(str(path))["machineId"], CONFIG["machineId"])
            metadata = SimpleNamespace(st_mode=stat.S_IFREG | 0o644, st_uid=1000)
            with patch("push_telemetry.os.name", "posix"), patch("push_telemetry.os.fstat", return_value=metadata):
                with self.assertRaises(ConfigError) as error:
                    load_config(str(path))
            self.assertNotIn(CONFIG["token"], str(error.exception))
            self.assertIn("0600", str(error.exception))

    def test_payload_is_metrics_only_plus_identity_kind_and_read_timestamp(self):
        opener = Opener([Response(GPU_METRICS), Response(b'{"ignored":"sensitive response"}')])
        client = Client(parse_config(CONFIG), opener)
        status = client.push_source("nvidia", CONFIG["nvidiaUrl"])
        self.assertEqual(status, "ok")
        get, post = opener.calls
        self.assertEqual(get[1], 3)
        self.assertEqual(post[1], 4)
        self.assertEqual(post[0].get_method(), "POST")
        self.assertEqual(post[0].get_header("Authorization"), "Bearer " + CONFIG["token"])
        payload = json.loads(post[0].data)
        self.assertEqual(set(payload), {"machineId", "kind", "sampledAt", "metrics"})
        self.assertEqual(payload["metrics"], GPU_METRICS.decode())
        self.assertTrue(payload["sampledAt"].endswith("Z"))
        self.assertNotIn(CONFIG["nvidiaUrl"], post[0].data.decode())
        self.assertNotIn(CONFIG["token"], post[0].data.decode())

    def test_oversized_or_invalid_source_is_never_posted(self):
        for body, expected in ((b"x" * (MAX_METRICS_BYTES + 1), "metrics-too-large"),
                               (b"\xff", "source-unavailable"), (b"", "invalid-metrics")):
            opener = Opener([Response(body)])
            status = Client(parse_config(CONFIG), opener).push_source("node", CONFIG["nodeUrl"])
            self.assertEqual(status, expected)
            self.assertEqual(len(opener.calls), 1)

    def test_get_failure_does_not_block_other_source(self):
        opener = Opener([urllib.error.URLError("a private error"), Response(GPU_METRICS), Response()])
        statuses = Client(parse_config(CONFIG), opener).once()
        self.assertEqual(statuses, {"node": "source-unavailable", "nvidia": "ok"})

    def test_json_escaping_is_counted_against_wire_size_limit(self):
        opener = Opener([Response(b'"' * (MAX_METRICS_BYTES // 2 + 1))])
        status = Client(parse_config(CONFIG), opener).push_source("node", CONFIG["nodeUrl"])
        self.assertEqual(status, "payload-too-large")
        self.assertEqual(len(opener.calls), 1)

    def test_post_failure_has_only_status_and_redirects_cannot_forward_authorization(self):
        error = urllib.error.HTTPError(CONFIG["endpoint"], 401, CONFIG["token"], {}, None)
        opener = Opener([Response(GPU_METRICS), error])
        status = Client(parse_config(CONFIG), opener).push_source("nvidia", CONFIG["nvidiaUrl"])
        self.assertEqual(status, "push-http-401")
        self.assertNotIn(CONFIG["token"], status)
        self.assertIsNone(NoRedirect().redirect_request(None, None, 307, None, {}, "https://example.invalid/"))

    def test_incomplete_http_response_is_redacted_and_recoverable(self):
        opener = Opener([http.client.IncompleteRead(b"private bytes"), Response(GPU_METRICS), Response()])
        client = Client(parse_config(CONFIG), opener)
        self.assertEqual(client.push_source("nvidia", CONFIG["nvidiaUrl"]), "source-unavailable")
        self.assertEqual(client.push_source("nvidia", CONFIG["nvidiaUrl"]), "ok")

    def test_cli_once_logs_status_only_and_returns_failure(self):
        config = parse_config(CONFIG)
        fake_client = SimpleNamespace(once=lambda: {"node": "ok", "nvidia": "push-http-401"})
        output = io.StringIO()
        with patch("sys.argv", ["push_telemetry.py", "--config", "private-fixture", "--once"]), \
                patch("push_telemetry.load_config", return_value=config), \
                patch("push_telemetry.Client", return_value=fake_client), contextlib.redirect_stdout(output):
            self.assertEqual(main(), 1)
        self.assertEqual(output.getvalue(), "node: ok\nnvidia: push-http-401\n")
        for private in (CONFIG["token"], CONFIG["nodeUrl"], CONFIG["endpoint"], GPU_METRICS.decode()):
            self.assertNotIn(private, output.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
