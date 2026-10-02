#!/usr/bin/env bash
# Dedicated ACL for new exporter ports only; existing listeners are preserved.
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
command -v iptables >/dev/null || { echo 'ACL: iptables unavailable'; exit 1; }
bind="${1:?bind address}"; shift
ports="${1:?ports}"; shift
[[ "$bind" =~ ^[0-9.]+$ && "$ports" =~ ^[0-9,]+$ && $# -gt 0 ]] || exit 1
for source in "$@"; do [[ "$source" =~ ^[0-9.]+$ ]] || exit 1; done
unit=/etc/systemd/system/hpclab-exporter-access.service
if [[ -f "$unit" ]] && ! grep -q '^# Managed by hpclab exporter installer$' "$unit"; then
  echo 'ACL: unmanaged unit preserved'; exit 1
fi
install -d -m 0755 /opt/hpclab-exporters
firewall=/opt/hpclab-exporters/access.sh
{
  echo '#!/usr/bin/env bash'
  echo 'set -euo pipefail'
  echo 'iptables -w -N HPC_LAB_EXPORT 2>/dev/null || true'
  echo 'iptables -w -F HPC_LAB_EXPORT'
  echo 'iptables -w -A HPC_LAB_EXPORT -i lo -j ACCEPT'
  for source in "$@"; do printf 'iptables -w -A HPC_LAB_EXPORT -s %q -j ACCEPT\n' "$source"; done
  echo 'iptables -w -A HPC_LAB_EXPORT -p tcp -j REJECT --reject-with tcp-reset'
  printf 'iptables -w -C INPUT -p tcp -d %q -m multiport --dports %q -j HPC_LAB_EXPORT 2>/dev/null || iptables -w -I INPUT 1 -p tcp -d %q -m multiport --dports %q -j HPC_LAB_EXPORT\n' "$bind" "$ports" "$bind" "$ports"
} > "$firewall"
chmod 0700 "$firewall"
cat > "$unit" <<'EOF'
# Managed by hpclab exporter installer
[Unit]
Description=HPC Lab exporter source access
After=network-online.target
Before=hpclab-node-exporter.service hpclab-nvidia-smi-exporter.service
[Service]
Type=oneshot
ExecStart=/opt/hpclab-exporters/access.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable hpclab-exporter-access.service >/dev/null 2>&1
systemctl restart hpclab-exporter-access.service
echo 'ACL: allowed monitoring sources only'
