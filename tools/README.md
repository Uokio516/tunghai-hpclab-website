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
**不需要**寫 hostPath。`server.ts` 的 `readSnapshot()` 比較映像中的預設資料與
`data/<name>.json` 的 `updatedAt`，採用較新的一份。更新盤點資料時採 build、push、rollout
流程，避免不同節點掛載的檔案版本不一致。

## 規則

- **連不到的機器不顯示。** 探測不到的機器代表已被搬移，`include:false`，
  不出現在頁面、也不計入總量；下次重跑探測時會自動回來。
- **同一張卡只算一次。** 直通給 VM 的顯示卡算在實體主機上，客體 VM 不重複計算
  （`virtual:true`）；內顯／GeForce 210 標為 `display-only` 不列入算力；
  Jetson 類標為 `edge`，另外計數。
- **機器 IP 不外流。** `/api/gpus` 與 `/api/lab-inventory` 都會在回傳前移除 `ip` 與 `ports`，
  與既有 Prometheus 端點的作法一致。
- 機器換網段（例如併入 gpu-cluster）時，在 `build-inventory.py` 的 `READDRESSED` 加一行；
  清冊上沒有的節點加進 `EXTRAS`。

## collect-cluster-status.sh

早期版本，**輸出的 JSON schema 與前端不相容**（`gpuCluster`/`proxmox`/`a100`，
前端要的是 `clusters[]`），直接 `--apply` 會讓 /infrastructure 整頁空白。
請改用 `build-cluster-status.py`。

## 即時監控與驗證

- `/gpus` 每 5 秒取得資料，隱藏分頁暫停輪詢；未接 exporter 的機器每 60 秒做 TCP 連線探測。
- GPU 使用率取 Prometheus 最新 `nvidia_smi_utilization_gpu_ratio`，不是移動平均。
  `sampledAt` 是實際採樣時間；超過 120 秒、主機離線或 collector 失敗時，使用率回傳 `null`。
- 網頁的「取得資料」與每張 GPU 的「採樣」時間分開標示。無遙測的設備不推估使用率，
  連線可達也不等於 GPU 閒置。卡片與表格共用同一組資料。
- `node tools/verify-gpu-monitoring.mjs` 使用假的 Prometheus 與暫存 SQLite，驗證最新採樣、
  使用率變動、資料過期、採集失敗、離線、IP 隱藏與錯誤恢復；不探測實驗室機器。
