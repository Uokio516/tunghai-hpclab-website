# Jetson／A100 唯讀遙測

兩個工具僅使用 Python 標準庫，依賴機器原有的 NVIDIA 唯讀工具。它們不安裝驅動、
不更動 MIG、不重設 GPU、不執行負載測試、不變更 Prometheus 或防火牆。

| 工具 | 本機資料來源 | HTTP 預設埠 |
|---|---|---|
| `jetson_exporter.py` | `tegrastats --interval 1000`、`/proc/stat`、`/proc/meminfo` | 9401 |
| `mig_telemetry.py` | `nvidia-smi -q -x`、`nvidia-smi -L` | 9401 |

服務每 5 秒執行一輪採集。HTTP `/telemetry` 與 `/json` 回傳同一份成功採樣快取；
`/metrics` 提供 Prometheus 格式；`/health` 在最新採集成功且未過期時回傳 200，否則 503。
讀 HTTP 不觸發 vendor 工具。機器 ID 請使用清冊 ID，例如 `inv-04`，不要使用位址。

`sampledAt`／`updatedAt`／`lastSuccessAt` 是成功讀取後的 UTC 時間。採集失敗時，
`collectionSuccess:false`、`online:false`，保留最後成功時間、清空顯存／溫度／功耗／
使用率等測量；缺失或不支援的指標是 `null` 或省略的 metric，不是 0。
`online` 表示遙測可用性；網站仍應分開判斷機器的 TCP 可達狀態。

Jetson 的 `utilMetric:"gpu-activation"` 來自 `GR3D_FREQ` 的 GPU 活躍比例。
JSON 與 metrics 的 `util` 都是 0 到 1 的比例；例如 37% 回傳 `0.37`。
`memoryShared:true`，機器層 `sharedMemory` 是 tegrastats 的 RAM 用量；GPU 的
`memUsed`／`memTotal` 始終為 `null`，不把共用 RAM 當成獨立 VRAM。
只把獨立 `VDD_GPU`／`POM_5V_GPU` rail 當 GPU 功耗，CPU/GPU/SOC 混合 rail 不換算。
每次只終止自己建立的 tegrastats 子行程；不使用會停止其他行程的 `--stop`。

A100 的 `migSlices` 只用 XML 的 index／GI／CI／SM／實際顯存及 `-L` 的實際 profile。
缺少片的測量或識別資訊時保持 `null`；不從 profile 名稱猜容量、SM、GI 或 CI。
整卡總顯存來自整卡 XML，不加總切片（同一個 GI 內的 CI 可以共用記憶體）。
MIG 開啟時 `util:null`、`utilAvailable:false`、`utilUnavailableReason:"mig-enabled"`。
此工具不替代 DCGM profiling。GPU UUID 僅供伺服器端去重，網站 API 不應回傳它。

在主機本機安裝，先把指定 exporter、`telemetry_common.py` 和 helper 複製到同一個目錄：

```sh
# Jetson；請把 inventory-example 換成實際清冊 ID
sudo sh ./install-specialized-exporter.sh jetson inventory-example

# A100；與 Jetson 二擇一，一台主機預設只佔用同一個 9401 埠
sudo sh ./install-specialized-exporter.sh mig inv-04
```

helper 使用非 root 的 `hpc-exporter` 帳號，先檢查實際讀取成功後才啟用指定服務。
既有服務名字由其他安裝擁有或目標埠已被占用時會停止。來源位址／防火牆允許範圍由
部署者按內網收集路徑設定；本工具不建立公開網路開放規則。
若 vendor 工具需要額外權限，先確認該機器支援的唯讀裝置權限；不要為此改 MIG／驅動。

離線驗證不連線任何實驗室主機、不執行 vendor 程式：

```sh
python tools/exporters/verify-specialized-exporters.py
```

解析依據：

- [NVIDIA nvidia-smi XML 與 MIG 指標文件](https://docs.nvidia.com/deploy/nvidia-smi/index.html)
- [NVIDIA MIG profile listing 與使用率限制](https://docs.nvidia.com/datacenter/tesla/mig-user-guide/getting-started-with-mig.html)
- [NVIDIA tegrastats 欄位定義](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/AT/JetsonLinuxDevelopmentTools/TegrastatsUtility.html)
- [CEEMS 原始 XML parser](https://github.com/ceems-dev/ceems/blob/main/pkg/collector/gpu.go)
- [CEEMS 原始 MIG XML fixture](https://github.com/ceems-dev/ceems/blob/main/pkg/collector/testdata/nvidia-smi)

NVIDIA 說明 XML 對應隨驅動提供的 DTD；XML tag 補以實際原始 parser／fixture 核查。
本專案離線 fixture 的 UUID 與數值是明確標示的合成測試資料，不部署到監控端。
