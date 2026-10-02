# tools — 算力盤點與快照產生

網站上的兩個數字來源，都由這裡的腳本產生，不需要人工改 JSON。

```
HPC Device List.xlsx ──build-inventory.py──▶ tools/data/lab-inventory.raw.json
                                                      │
                     probe-inventory.py ──▶ tools/data/lab-reachability.json
                                                      │
                            finalize-inventory.py ────┴──▶ lab-inventory.default.json   → /api/gpus、/api/lab-inventory

kubectl get nodes -o json ──▶ tools/data/gpu-cluster-nodes.json
                                      └── build-cluster-status.py ──▶ cluster-status.default.json → /api/cluster-status
```

## 完整重跑

```bash
python tools/build-inventory.py "C:/Users/PKH/Downloads/HPC Device List.xlsx"
python tools/probe-inventory.py        # ICMP + TCP，只讀不登入
ssh -i ~/.ssh/pk-lab-2026 ubuntu@172.24.13.244 \
  'sudo -n /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml get nodes -o json' \
  > tools/data/gpu-cluster-nodes.json
python tools/finalize-inventory.py
python tools/build-cluster-status.py
```

兩個 `*.default.json` 都會被 `COPY . .` 打進映像，所以重新 build + push + rollout 就會生效，
**不需要**寫 hostPath。若要在不重新部署的情況下更新，把檔案改名放到 `data/` 即可
（`server.ts` 的 `readSnapshot()` 會優先讀 `data/<name>.json`）。
⚠️ 走 hostPath 這條路時，3 個節點都要寫，否則使用者會隨機看到新舊資料。

## 規則

- **連不到的機器不顯示。** 探測不到的機器代表已被搬移，`include:false`，
  不出現在頁面、也不計入總量；下次重跑探測時會自動回來。
- **同一張卡只算一次。** 直通給 VM 的顯示卡算在實體主機上，客體 VM 不重複計算
  （`virtual:true`）；內顯／GeForce 210 標為 `display-only` 不列入算力；
  Jetson 類標為 `edge`，另外計數。
- **機器 IP 不外流。** `/api/gpus` 與 `/api/lab-inventory` 都會在回傳前移除 `ip`，
  與既有 Prometheus 端點的作法一致。
- 機器換網段（例如併入 gpu-cluster）時，在 `build-inventory.py` 的 `READDRESSED` 加一行；
  清冊上沒有的節點加進 `EXTRAS`。

## collect-cluster-status.sh

早期版本，**輸出的 JSON schema 與前端不相容**（`gpuCluster`/`proxmox`/`a100`，
前端要的是 `clusters[]`），直接 `--apply` 會讓 /infrastructure 整頁空白。
請改用 `build-cluster-status.py`。
