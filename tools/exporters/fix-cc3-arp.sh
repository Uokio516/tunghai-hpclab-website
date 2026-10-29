#!/usr/bin/env bash
# cc3 has two NICs on the same L2 (enp1s0 172.24.13.244, enp2s0 140.128.101.197). With the
# default arp_ignore=0 either NIC answers ARP for either address, so the router sometimes
# delivers replies for 172.24.13.244 to enp2s0. OpenStack's per-port conntrack then drops
# the rest of the TCP flow: ping works, the handshake works, HTTP never arrives. This is
# what kept breaking the pk-5090 relay (2026-10-29). Only reduces ARP replies; no proxy ARP.
set -euo pipefail
cat > /etc/sysctl.d/90-hpclab-arp.conf <<'CONF'
net.ipv4.conf.all.arp_ignore = 1
net.ipv4.conf.all.arp_announce = 2
CONF
sysctl -p /etc/sysctl.d/90-hpclab-arp.conf
for i in enp1s0 enp2s0; do sysctl -w net.ipv4.conf.$i.arp_ignore=1 net.ipv4.conf.$i.arp_announce=2; done
# Refresh the router's entry for 172.24.13.244 from the right NIC.
if command -v arping >/dev/null; then arping -c 3 -U -I enp1s0 -s 172.24.13.244 172.24.13.254 || true; fi
sleep 3
for p in 9100 9835; do echo "pk-5090:$p $(curl --noproxy '*' -s -m 8 -o /dev/null -w '%{http_code}' http://172.24.12.85:$p/metrics)"; done
