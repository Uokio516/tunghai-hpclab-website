#!/bin/sh
# Install only the stdlib push client locally. Root manages the source config/token.
set -eu
config_source=${1:?Usage: install-push-exporter.sh PRIVATE_CONFIG_FILE}
test "$(id -u)" -eq 0 || { printf '%s\n' 'Run this local helper as root.' >&2; exit 2; }
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_dir=/usr/local/lib/hpc-lab-exporters
config_dir=/etc/hpc-lab-exporters
config_target=$config_dir/push.json
unit_path=/etc/systemd/system/hpc-exporter-push.service
python_binary=$(command -v python3)
test -f "$source_dir/push_telemetry.py"
test -f "$config_source"
if test -f "$unit_path" && ! grep -Fq "$target_dir/push_telemetry.py" "$unit_path"; then
  printf '%s\n' 'The service name is already owned by another installation.' >&2
  exit 2
fi
if ! getent passwd hpc-exporter >/dev/null; then
  useradd --system --user-group --no-create-home --shell /usr/sbin/nologin hpc-exporter
fi
exporter_group=$(id -gn hpc-exporter)
stage_dir=$(mktemp -d)
unit_tmp=$(mktemp)
cleanup() {
  rm -f -- "$unit_tmp" "$stage_dir/push_telemetry.py" "$stage_dir/push.json"
  rmdir -- "$stage_dir"
}
trap cleanup EXIT HUP INT TERM
chmod 0755 "$stage_dir"
install -m 0644 "$source_dir/push_telemetry.py" "$stage_dir/push_telemetry.py"
install -m 0600 -o hpc-exporter -g "$exporter_group" "$config_source" "$stage_dir/push.json"
runuser -u hpc-exporter -- "$python_binary" -B "$stage_dir/push_telemetry.py" --config "$stage_dir/push.json" --check >/dev/null
install -d -m 0755 "$target_dir"
install -d -m 0750 -o root -g "$exporter_group" "$config_dir"
install -m 0644 "$stage_dir/push_telemetry.py" "$target_dir/push_telemetry.py"
install -m 0600 -o hpc-exporter -g "$exporter_group" "$stage_dir/push.json" "$config_target"
cat >"$unit_tmp" <<EOF
[Unit]
Description=HPC lab local exporter HTTPS push
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=hpc-exporter
Group=$exporter_group
ExecStart=$python_binary -B $target_dir/push_telemetry.py --config $config_target --interval 5
Restart=on-failure
RestartSec=5
TimeoutStopSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=128M
CPUQuota=20%
TasksMax=16
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
if test -f "$unit_path"; then
  cp -p -- "$unit_path" "$unit_path.previous"
fi
install -m 0644 "$unit_tmp" "$unit_path"
systemctl daemon-reload
systemctl enable hpc-exporter-push.service >/dev/null
systemctl restart hpc-exporter-push.service
systemctl is-active --quiet hpc-exporter-push.service
printf '%s\n' 'Push service active. Verify one actual upload with --once as the service account.'
