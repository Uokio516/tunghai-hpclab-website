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
# arping is not installed on cc3, and until the router hears a gratuitous ARP it keeps the
# stale enp2s0 MAC, so the sysctl alone did not fix it (2026-10-29). Announce our own
# address/MAC only.
python3 - <<'PY'
import socket, struct, time
IF = "enp1s0"; IP = socket.inet_aton("172.24.13.244")
mac = bytes.fromhex(open(f"/sys/class/net/{IF}/address").read().strip().replace(":", ""))
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW); s.bind((IF, 0))
bc = b"\xff" * 6
for op in (1, 2):
    arp = struct.pack("!HHBBH", 1, 0x0800, 6, 4, op) + mac + IP + (b"\x00" * 6 if op == 1 else bc) + IP
    for _ in range(3):
        s.send(bc + mac + b"\x08\x06" + arp); time.sleep(0.3)
PY
sleep 3
for p in 9100 9835; do echo "pk-5090:$p $(curl --noproxy '*' -s -m 8 -o /dev/null -w '%{http_code}' http://172.24.12.85:$p/metrics)"; done
