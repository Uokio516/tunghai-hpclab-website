# 無法拉取主機的 HTTPS 推送

`push_telemetry.py` 是獨立 Python 標準庫 client。不改既有 node／GPU exporter，
只讀本機 loopback `/metrics`，每 5 秒將最新原始內容推送給網站的內部接收端。
GET timeout 為 3 秒，POST timeout 為 4 秒；慢回應時略過錯失的週期，不疊加請求或密集重試。

設定由部署者保存在 Git repo 之外；檔案權限必須為 0600，且服務帳號可讀：

```json
{
  "machineId": "inventory-example",
  "endpoint": "https://hpclab.thu.edu.tw/api/internal/exporter-telemetry",
  "token": "REPLACE_WITH_PRIVATE_TOKEN",
  "nodeUrl": "http://localhost:9100/metrics",
  "nvidiaUrl": "http://localhost:9835/metrics"
}
```

`machineId` 應換成清冊 ID。`nodeUrl`／`nvidiaUrl` 至少有一個；只接受本機 loopback HTTP／HTTPS。
遠端端點必須使用 HTTPS 與內部 telemetry 路徑。TLS 憑證會正常驗證；不繼承 proxy，
不跟隨 redirect。Token 只放在 Authorization header，不放 URL 或 POST body。

每個來源 GET 成功後分開 POST：

```text
{ machineId, kind: "node" | "nvidia", sampledAt: UTC ISO 時間, metrics: 原始字串 }
```

`sampledAt` 為此次本機 metrics 成功讀取時間。GPU metrics 中原有的真實採樣／最後成功
timestamp 保持原樣，伺服器應優先使用它。JSON 不帶來源 URL 或機器位址；原始 metrics
只送網站後端，由後端的 allowlist 轉為公開 API。單份原始 metrics 與序列化 POST body
都不得超過 2 MiB，超過時略過並只記錄固定狀態。

本機 root 安裝：先把 client、helper 與部署者的私密設定放在主機上，然後執行：

```sh
sudo sh ./install-push-exporter.sh /path/to/private-push-config.json

# 實際驗證，只輸出 node／nvidia 的成功或失敗狀態
sudo -u hpc-exporter python3 -B /usr/local/lib/hpc-lab-exporters/push_telemetry.py \
  --config /etc/hpc-lab-exporters/push.json --once
```

helper 使用非 root 的 `hpc-exporter` 帳號，設定放在
`/etc/hpc-lab-exporters/push.json`（owner `hpc-exporter`，0600），服務為
`hpc-exporter-push.service`。它不更動防火牆、Prometheus、驅動或既有 exporter。
`--check` 只驗證設定、不連線；`--once` 有任一來源失敗時 exit code 為 1。
持續模式只在狀態改變時寫日誌，不輸出 token、URL、位址、response body 或 metrics。

只用 mock HTTP 的離線檢查：

```sh
python tools/exporters/verify-push-telemetry.py
```
