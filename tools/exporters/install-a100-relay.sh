#!/usr/bin/env bash
# Relay lib-a100-cc1 exporters (reachable only over wg-a100) to the website, same
# allowlist and hardening as the pk-5090 relays on 9300/9301.
set -euo pipefail
A=/opt/hpclab-exporters/access.sh
cp -n "$A" "$A.bak-20261029"
sed -i 's/9100\\,9835\\,9300\\,9301/9100\\,9835\\,9300\\,9301\\,9302\\,9303/g' "$A"
grep -q '9302' "$A"

unit() { # name kind listen-port source-port
cat > "/etc/systemd/system/$1.service" <<EOF
# Managed by hpclab A100 relay (2026-10-29)
[Unit]
Description=HPC lab A100 $2 exporter relay
After=network-online.target hpclab-exporter-access.service
Requires=hpclab-exporter-access.service
[Service]
Type=simple
User=hpclab_exporter
ExecStart=/usr/bin/python3 -B /opt/hpclab-exporters/relay_metrics.py --listen 172.24.13.244 --source 172.24.13.211 --kind $2 --listen-port $3 --source-port $4
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
MemoryMax=64M
CPUQuota=20%
[Install]
WantedBy=multi-user.target
EOF
}
unit hpclab-a100-node-relay node 9302 9100
unit hpclab-a100-gpu-relay gpu 9303 9835
systemctl daemon-reload
systemctl restart hpclab-exporter-access
systemctl enable --now hpclab-a100-node-relay hpclab-a100-gpu-relay
sleep 2
systemctl is-active hpclab-a100-node-relay hpclab-a100-gpu-relay
for p in 9302 9303; do echo "$p $(curl --noproxy '*' -s -m 8 -o /dev/null -w '%{http_code}' http://172.24.13.244:$p/metrics)"; done
