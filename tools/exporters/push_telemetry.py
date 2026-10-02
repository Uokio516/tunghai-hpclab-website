#!/usr/bin/env python3
"""Push local exporter metrics over verified HTTPS; standard library only.

Secrets are read only from an owner-readable 0600 configuration file. This
client never logs URLs, addresses, tokens, response bodies or metrics.
"""

import argparse
import datetime
import http.client
import ipaddress
import json
import os
import re
import signal
import ssl
import stat
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


MAX_METRICS_BYTES = 2 * 1024 * 1024
MAX_CONFIG_BYTES = 16 * 1024
GET_TIMEOUT_SECONDS = 3
POST_TIMEOUT_SECONDS = 4


class ConfigError(ValueError):
    """Only fixed, non-secret messages may be supplied to this exception."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None  # A redirect must never forward Authorization to another endpoint.


def validate_url(value, local=False):
    if not isinstance(value, str) or not value or len(value) > 2048 or re.search(r"\s", value):
        raise ConfigError("Configuration contains an invalid endpoint.")
    try:
        parsed = urllib.parse.urlsplit(value)
        port = parsed.port
    except ValueError:
        raise ConfigError("Configuration contains an invalid endpoint.") from None
    if not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.fragment or parsed.query:
        raise ConfigError("Configuration contains an invalid endpoint.")
    if port is not None and not 1 <= port <= 65535:
        raise ConfigError("Configuration contains an invalid endpoint.")
    if local:
        if parsed.scheme not in ("http", "https"):
            raise ConfigError("Local metric sources must use HTTP or HTTPS.")
        try:
            loopback = ipaddress.ip_address(parsed.hostname).is_loopback
        except ValueError:
            loopback = parsed.hostname.lower() == "localhost"
        if not loopback:
            raise ConfigError("Metric sources must be local loopback endpoints.")
        if parsed.path != "/metrics":
            raise ConfigError("Local metric source must use the metrics path.")
    elif parsed.scheme != "https" or parsed.path != "/api/internal/exporter-telemetry":
        raise ConfigError("The push endpoint must use HTTPS and the internal telemetry path.")
    return value


def parse_config(raw):
    if not isinstance(raw, dict):
        raise ConfigError("Configuration must be a JSON object.")
    machine_id = raw.get("machineId")
    if not isinstance(machine_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", machine_id):
        raise ConfigError("Configuration contains an invalid inventory ID.")
    token = raw.get("token")
    if not isinstance(token, str) or not 1 <= len(token) <= 4096 or not re.fullmatch(r"[!-~]+", token):
        raise ConfigError("Configuration contains an invalid bearer token.")
    endpoint = validate_url(raw.get("endpoint"))
    targets = []
    for kind, field in (("node", "nodeUrl"), ("nvidia", "nvidiaUrl")):
        url = raw.get(field)
        if url is not None:
            targets.append((kind, validate_url(url, local=True)))
    if not targets:
        raise ConfigError("At least one local exporter source is required.")
    # Return only the explicit allowlist. No extra configuration data is sent.
    return {"machineId": machine_id, "endpoint": endpoint, "token": token, "targets": targets}


def load_config(path):
    fd = None
    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise ConfigError("Configuration must be a regular file.")
        if os.name == "posix":
            if stat.S_IMODE(info.st_mode) != 0o600:
                raise ConfigError("Configuration permissions must be exactly 0600.")
            if os.getuid() != 0 and info.st_uid != os.getuid():
                raise ConfigError("Configuration must belong to the service account.")
        with os.fdopen(fd, "rb") as stream:
            fd = None
            content = stream.read(MAX_CONFIG_BYTES + 1)
        if len(content) > MAX_CONFIG_BYTES:
            raise ConfigError("Configuration is too large.")
        return parse_config(json.loads(content.decode("utf-8-sig")))
    except ConfigError:
        raise
    except (OSError, UnicodeError, ValueError):
        raise ConfigError("Unable to read a valid private configuration file.") from None
    finally:
        if fd is not None:
            os.close(fd)


def timestamp_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


class Client:
    def __init__(self, config, opener=None):
        self.config = config
        self.opener = opener or urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect(),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        )

    def push_source(self, kind, source):
        try:
            request = urllib.request.Request(source, headers={"Accept": "text/plain", "Accept-Encoding": "identity"})
            with self.opener.open(request, timeout=GET_TIMEOUT_SECONDS) as response:
                body = response.read(MAX_METRICS_BYTES + 1)
            sampled_at = timestamp_now()
            if len(body) > MAX_METRICS_BYTES:
                return "metrics-too-large"
            metrics = body.decode("utf-8")
            if not metrics.strip() or "\x00" in metrics:
                return "invalid-metrics"
        except (OSError, UnicodeError, urllib.error.URLError, http.client.HTTPException, ValueError):
            return "source-unavailable"
        payload = json.dumps({"machineId": self.config["machineId"], "kind": kind,
                              "sampledAt": sampled_at, "metrics": metrics},
                             ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(payload) > MAX_METRICS_BYTES:
            return "payload-too-large"  # Count JSON escaping/header fields against the route limit.
        request = urllib.request.Request(
            self.config["endpoint"], data=payload, method="POST",
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + self.config["token"],
                     "Accept": "application/json", "Accept-Encoding": "identity"},
        )
        try:
            with self.opener.open(request, timeout=POST_TIMEOUT_SECONDS) as response:
                code = response.getcode()
                # The reply is deliberately ignored; it could contain addresses.
            return "ok" if 200 <= code < 300 else "push-http-%d" % code
        except urllib.error.HTTPError as error:
            return "push-http-%d" % error.code
        except (OSError, urllib.error.URLError, http.client.HTTPException, ValueError):
            return "push-unavailable"

    def once(self, stop=None):
        statuses = {}
        for kind, source in self.config["targets"]:
            if stop is not None and stop.is_set():
                break
            statuses[kind] = self.push_source(kind, source)
        return statuses


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--check", action="store_true", help="Validate the private configuration without network requests.")
    args = parser.parse_args()
    if not 5 <= args.interval <= 60:
        parser.error("interval must be between 5 and 60 seconds")
    try:
        config = load_config(args.config)
    except ConfigError as error:
        parser.exit(2, str(error) + "\n")
    if args.check:
        print("Private exporter configuration validated.")
        return 0
    client = Client(config)
    if args.once:
        statuses = client.once()
        for kind, status in statuses.items():
            print("%s: %s" % (kind, status))
        return 0 if statuses and all(status == "ok" for status in statuses.values()) else 1
    stop = threading.Event()
    def shutdown(signum, frame):
        stop.set()
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    previous = {}
    next_tick = time.monotonic()
    while not stop.is_set():
        statuses = client.once(stop)
        for kind, status in statuses.items():
            if previous.get(kind) != status:
                print("%s: %s" % (kind, status), flush=True)
        previous = statuses
        next_tick += args.interval
        now = time.monotonic()
        while next_tick <= now:
            next_tick += args.interval  # Skip missed ticks; never overlap or burst retries.
        stop.wait(max(0, next_tick - now))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
