#!/usr/bin/env bash
# collect-cluster-status.sh
#
# 產生 /api/cluster-status 所讀的 data/cluster-status.json。
#
# server.ts 的設計：
#   data/cluster-status.json       <- 有就讀這個（本腳本產生）
#   cluster-status.default.json    <- 沒有才用內建的（2026-07-21 的舊快照）
#
# data/ 即容器掛載的 hostPath /var/lib/hpc-lab-data。
#
# ⚠️ hpc-lab-site 目前有 2 個副本，各自掛自己節點上的 hostPath。
#    只寫一個節點，使用者會隨機看到新舊兩種資料。本腳本會兩個都寫。
#
# 用法：  ./collect-cluster-status.sh            產生並印出，不寫入
#        ./collect-cluster-status.sh --apply    產生並寫入兩個節點

set -uo pipefail
KEY="${KEY:-$HOME/.ssh/pk-lab-2026}"
SSH="ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10"
OUT="${OUT:-/tmp/cluster-status.json}"

# gpu-cluster 的任一 control-plane
GPUC=172.24.13.244
# pk-cluster（網站所在）
PKC=172.24.13.41

echo "== 收集 gpu-cluster ==" >&2
GPU_JSON=$($SSH -n ubuntu@$GPUC '
  K="sudo -n /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml"
  $K get nodes -o json 2>/dev/null
' 2>/dev/null)

echo "== 收集 Proxmox 實體節點 ==" >&2
PVE_JSON="["
first=1
for ip in 172.24.13.171 172.24.13.172 172.24.13.173 172.24.13.174 172.24.13.175 172.24.13.176 172.24.13.177; do
  d=$($SSH -n root@$ip '
    printf "{\"name\":\"%s\",\"threads\":%s,\"ramGB\":%s,\"gpu\":\"%s\",\"uptime\":\"%s\"}" \
      "$(hostname)" "$(nproc)" "$(free -g | awk "/Mem:/{print \$2}")" \
      "$(lspci -nn 2>/dev/null | grep -iE "VGA|3D controller" | grep -i nvidia | sed "s/.*: //" | head -1 | cut -c1-60)" \
      "$(uptime -p)"
  ' 2>/dev/null)
  if [ -n "$d" ]; then
    [ $first -eq 0 ] && PVE_JSON="$PVE_JSON,"
    PVE_JSON="$PVE_JSON$d"; first=0
  fi
done
PVE_JSON="$PVE_JSON]"

echo "== 收集 CubeCOS 三節點 ==" >&2
# 這三台只收密碼，需 plink 或已部署金鑰；取不到就留空，由人工補
CC_JSON="[]"

echo "== 收集 A100 ==" >&2
A100_JSON=$(ssh -p 42227 -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=no -n root@140.128.103.174 '
  printf "{\"host\":\"%s\",\"threads\":%s,\"ramGB\":%s,\"gpu\":\"A100 PCIe 40GB\",\"driverBinding\":\"%s\",\"inCluster\":false}" \
    "$(hostname)" "$(nproc)" "$(free -g | awk "/Mem:/{print \$2}")" \
    "$(lspci -nnks 21:00.0 2>/dev/null | grep -i "Kernel driver" | cut -d: -f2 | tr -d " ")"
' 2>/dev/null)
[ -z "$A100_JSON" ] && A100_JSON='null'

python3 - "$GPU_JSON" "$PVE_JSON" "$A100_JSON" > "$OUT" <<'PY'
import json, sys, datetime

gpu_raw, pve_raw, a100_raw = sys.argv[1], sys.argv[2], sys.argv[3]

nodes = []
try:
    d = json.loads(gpu_raw)
    for n in d.get("items", []):
        m, st = n["metadata"], n["status"]
        alloc, cap = st.get("allocatable", {}), st.get("capacity", {})
        ready = next((c["status"] for c in st.get("conditions", []) if c["type"] == "Ready"), "Unknown")
        nodes.append({
            "name": m["name"],
            "ready": ready == "True",
            "schedulable": not n.get("spec", {}).get("unschedulable", False),
            "taints": [t.get("key") for t in (n.get("spec", {}).get("taints") or [])],
            "cpuThreads": int(cap.get("cpu", 0)),
            "ramGB": round(int(cap.get("memory", "0Ki").rstrip("Ki")) / 1048576, 1),
            "gpus": int(alloc.get("nvidia.com/gpu", 0) or 0),
            "kernel": st.get("nodeInfo", {}).get("kernelVersion", ""),
            "kubelet": st.get("nodeInfo", {}).get("kubeletVersion", ""),
        })
except Exception as e:
    print("gpu-cluster 解析失敗: %s" % e, file=sys.stderr)

try:    pve = json.loads(pve_raw)
except Exception: pve = []
try:    a100 = json.loads(a100_raw) if a100_raw != "null" else None
except Exception: a100 = None

gpus_in_cluster = sum(n["gpus"] for n in nodes)
gpus_total = gpus_in_cluster + (1 if a100 else 0)

out = {
    "updatedAt": datetime.date.today().isoformat(),
    "source": "collector",
    "summary": {
        "gpusTotal": gpus_total,
        "gpusInCluster": gpus_in_cluster,
        "gpusPending": 1 if a100 else 0,
        "clusterNodes": len(nodes),
        "clusterNodesReady": sum(1 for n in nodes if n["ready"]),
        "clusterCpuThreads": sum(n["cpuThreads"] for n in nodes),
        "clusterMemoryGB": round(sum(n["ramGB"] for n in nodes)),
        "proxmoxNodes": len(pve),
        "proxmoxCpuThreads": sum(p.get("threads", 0) for p in pve),
        "proxmoxMemoryGB": sum(p.get("ramGB", 0) for p in pve),
    },
    "gpuCluster": {"name": "gpu-cluster", "nodes": nodes},
    "proxmox": {"name": "hpccluster", "nodes": pve},
    "a100": a100,
}
print(json.dumps(out, ensure_ascii=False, indent=2))
PY

echo "== 產生完成：$OUT ==" >&2
python3 -c "
import json,io
d=json.load(io.open('$OUT',encoding='utf-8'))
s=d['summary']
print()
for k,v in s.items(): print('  %-22s %s' % (k,v))
" >&2

if [ "${1:-}" = "--apply" ]; then
  echo >&2
  echo "== 寫入兩個節點的 hostPath ==" >&2
  for ip in 172.24.13.41 172.24.13.42 172.24.13.43; do
    scp -i "$KEY" -o StrictHostKeyChecking=no -q "$OUT" ubuntu@$ip:/tmp/cs.json 2>/dev/null && \
    $SSH -n ubuntu@$ip 'sudo -n mkdir -p /var/lib/hpc-lab-data && sudo -n cp /tmp/cs.json /var/lib/hpc-lab-data/cluster-status.json && rm -f /tmp/cs.json && echo "  '$ip' 已寫入"' 2>/dev/null
  done
  echo >&2
  echo "== 驗證 ==" >&2
  curl -sk https://hpclab.thu.edu.tw/api/cluster-status 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  updatedAt:', d.get('updatedAt'), ' source:', d.get('source'))
" >&2
fi
