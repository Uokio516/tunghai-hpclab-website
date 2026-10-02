#!/bin/sh
# Local root helper only. Copy this helper, telemetry_common.py and the selected
# exporter to the host first. Does not install/upgrade drivers, DCGM or JetPack.
set -eu

mode=${1:?Usage: install-specialized-exporter.sh jetson|mig INVENTORY_ID [LISTEN] [PORT]}
machine_id=${2:?Inventory ID is required}
listen=${3:-0.0.0.0}
port=${4:-9401}
case "$mode" in
  jetson) script=jetson_exporter.py; binary=tegrastats; service=hpc-jetson-telemetry ;;
  mig) script=mig_telemetry.py; binary=nvidia-smi; service=hpc-mig-telemetry ;;
  *) printf '%s\n' 'Unsupported exporter type.' >&2; exit 2 ;;
esac
test "$(id -u)" -eq 0 || { printf '%s\n' 'Run this local helper as root.' >&2; exit 2; }
case "$machine_id" in *[!A-Za-z0-9_-]*|'') printf '%s\n' 'Invalid inventory ID.' >&2; exit 2 ;; esac
case "$listen" in *[!A-Za-z0-9.:_-]*|'') printf '%s\n' 'Invalid listen address.' >&2; exit 2 ;; esac
case "$port" in *[!0-9]*|'') printf '%s\n' 'Invalid port.' >&2; exit 2 ;; esac
python3 -c 'import sys; assert 1 <= int(sys.argv[1]) <= 65535' "$port"
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_dir=/usr/local/lib/hpc-lab-exporters
unit_path=/etc/systemd/system/$service.service
python_binary=$(command -v python3)
gpu_binary=$(command -v "$binary") || { printf '%s\n' 'Required vendor read-only utility is absent.' >&2; exit 2; }
test -f "$source_dir/$script"
test -f "$source_dir/telemetry_common.py"
if test -f "$unit_path" && ! grep -Fq "$target_dir/$script" "$unit_path"; then
  printf '%s\n' 'The selected service name is already owned by another installation.' >&2
  exit 2
fi
if ! systemctl is-active --quiet "$service.service"; then
  python3 -c 'import socket,sys; s=socket.socket(socket.AF_INET6 if ":" in sys.argv[1] else socket.AF_INET); s.bind((sys.argv[1],int(sys.argv[2]))); s.close()' "$listen" "$port"
fi
if ! getent passwd hpc-exporter >/dev/null; then
  useradd --system --user-group --no-create-home --shell /usr/sbin/nologin hpc-exporter
fi
exporter_group=$(id -gn hpc-exporter)
stage_dir=$(mktemp -d)
unit_tmp=$(mktemp)
cleanup() {
  rm -f -- "$unit_tmp" "$stage_dir/telemetry_common.py" "$stage_dir/$script"
  rmdir -- "$stage_dir"
}
trap cleanup EXIT HUP INT TERM
chmod 0755 "$stage_dir"
install -m 0644 "$source_dir/telemetry_common.py" "$stage_dir/telemetry_common.py"
install -m 0755 "$source_dir/$script" "$stage_dir/$script"
# Confirm the service account can collect real metrics before enabling anything.
runuser -u hpc-exporter -- "$python_binary" -B "$stage_dir/$script" --id "$machine_id" --binary "$gpu_binary" --once --format json >/dev/null
install -d -m 0755 "$target_dir"
install -m 0644 "$stage_dir/telemetry_common.py" "$target_dir/telemetry_common.py"
install -m 0755 "$stage_dir/$script" "$target_dir/$script"
cat >"$unit_tmp" <<EOF
[Unit]
Description=HPC lab read-only $mode telemetry
After=network.target

[Service]
Type=simple
User=hpc-exporter
Group=$exporter_group
ExecStart=$python_binary -B $target_dir/$script --id $machine_id --binary $gpu_binary --listen $listen --port $port --interval 5 --timeout 2
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=128M
CPUQuota=20%
TasksMax=32
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
if test -f "$unit_path"; then
  cp -p -- "$unit_path" "$unit_path.previous"
fi
install -m 0644 "$unit_tmp" "$unit_path"
systemctl daemon-reload
systemctl enable "$service.service" >/dev/null
systemctl restart "$service.service"
python3 - "$port" <<'PY'
import json, sys, time, urllib.request
endpoint = 'http://127.0.0.1:' + sys.argv[1] + '/telemetry'
for attempt in range(10):
    try:
        data = json.load(urllib.request.urlopen(endpoint, timeout=2))
        if data.get('collectionSuccess') and data.get('sampledAt'):
            print('Exporter active; real collection verified.')
            break
    except (OSError, ValueError):
        pass
    time.sleep(1)
else:
    raise SystemExit('Exporter is enabled, but real collection was not verified; inspect the selected service.')
PY
