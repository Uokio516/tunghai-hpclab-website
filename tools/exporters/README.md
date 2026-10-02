# Linux exporter 安裝

`install-linux.sh` 透過既有 SSH 的 root／sudo 執行，僅新增獨立 exporter 服務，不安裝套件、不更動驅動、MIG、防火牆或既有服務。兩個檔案須放在同一個遠端暫存目錄。

```bash
sudo bash install-linux.sh --node-version 1.12.1 --gpu-version 1.15.1
```

版本需明確指定。安裝器自官方 GitHub release 下載 binary 與 checksum 並驗證；一般下載失敗時，只改用相同官方 GitHub release 的 asset API（仍驗證 checksum 與 API digest）。離線主機可傳入預先下載且驗證過的檔案：

```bash
sudo bash install-linux.sh --node-version 1.12.1 \
  --node-archive /tmp/node_exporter-1.12.1.linux-amd64.tar.gz \
  --node-sha256 b51d8a76aa2a9156a55d501aca6276fae09e262259a5e4e831d2c2222f084e63
```

- 官方版本與 SHA：[Prometheus node_exporter releases](https://github.com/prometheus/node_exporter/releases)、[nvidia_gpu_exporter releases](https://github.com/utkuozdemir/nvidia_gpu_exporter/releases)。範例版本查核於 2026-10-02；不會自動升級既有 exporter。GPU 離線安裝參數為 `--gpu-version`、`--gpu-archive`、`--gpu-sha256`，與 node 參數相同規則。
- 9100／9835 已有 listener 時保留並回報，包含不是 exporter 的佔用；無法確定 listener 狀態時也跳過，不搶佔連接埠。既有不屬於本安裝器管理的同名 systemd unit 不會覆寫。沒有 systemd／python3、無權限或架構不支援時跳過。
- 新服務以 `hpclab_exporter` 非 root 帳號執行，binary 放在 `/opt/hpclab-exporters`；systemd 服務名稱為 `hpclab-node-exporter`、`hpclab-nvidia-smi-exporter`。
- 可用 `--skip-node`／`--skip-gpu` 選擇元件；預設綁定 `0.0.0.0`，可用 `--listen` 指定介面。單獨安裝器不改防火牆。
- GPU 使用官方 `utkuozdemir/nvidia_gpu_exporter` binary（exec backend），每輪 5 秒做一次唯讀 `nvidia-smi` 查詢，每次採集上限 4 秒，`/metrics` 不會另觸發 GPU 查詢。API 應使用真實採樣時間 `nvidia_smi_last_collect_success_timestamp_seconds` 判斷新鮮度。[官方配置文件](https://github.com/utkuozdemir/nvidia_gpu_exporter/blob/v1.15.1/docs/CONFIGURE.md)
- `N/A`、不支援欄位、失敗或過期採樣均不輸出假 0；MIG 模式不輸出 GPU 使用率。Jetson 不使用一般 NVIDIA exporter。MIG 利用率限制：[NVIDIA 文件](https://docs.nvidia.com/datacenter/tesla/mig-user-guide/latest/getting-started-with-mig.html#gpu-utilization-metrics)。
- 官方 exporter 的 `/-/healthy`、`/-/ready` 為程序健康；採集是否成功須另讀 `nvidia_smi_last_collect_success`、`nvidia_smi_command_exit_code` 與最後成功時間。
- GPU metric labels 只含 index、GPU UUID、型號與驅動版本，不含機器 IP、清冊帳號或密碼。
- 安裝器不設定 Prometheus scrape target；網站／獨立 collector 的接入由部署工作負責。
- `nvidia_smi_exporter.py` 只供安裝前非 root 權限／唯讀採集檢查與診斷，不用它取代官方服務。自行執行的 `--once` 同樣省略 N/A、失敗或 MIG 的不支援使用率。

驗證：

```bash
systemctl is-active hpclab-node-exporter hpclab-nvidia-smi-exporter
python3 /opt/hpclab-exporters/nvidia_smi_exporter.py --once
curl --fail http://127.0.0.1:9835/-/healthy
curl --fail http://127.0.0.1:9835/metrics
```

移除僅停用新服務並刪除上述新建服務與 binary。原有 exporter 一律由原有管理方式維護。

## 全實驗室安裝與網站接入

`manage-fleet.py` 使用本機清冊 N／O 欄登入，帳密只留在記憶體，不輸出到報告。先做唯讀 audit，再明確指定已審核的機器安裝：

```powershell
python tools/exporters/manage-fleet.py --include-hidden
python tools/exporters/manage-fleet.py --install --ids inv-09
python tools/exporters/build-targets.py
```

audit、安裝結果、驗證過的官方下載檔及 SSH host keys 存在使用者 TEMP 的 `hpclab-exporter-private`。安裝模式保留既有 listener；需要已驗證的 `releases/manifest.json`、`kube-nodes.json` 與 `PROMETHEUS_URL.txt`。

全實驗室安裝模式會先執行 `restrict-linux.sh`，只針對新開的 exporter 連接埠新增獨立來源白名單：允許既有獨立 Prometheus 與網站 Kubernetes 節點，其餘來源拒絕。規則由 `hpclab-exporter-access.service` 開機載入，不更改其他連接埠的政策。既有 exporter 只額外加入網站節點的精確來源規則，保留原有 Prometheus 與拒絕規則。

`exporter-targets.default.json` 僅供伺服器讀取；URL 不回傳瀏覽器。網站每 5 秒採集新 exporter，原有 8 台維持既有獨立 Prometheus。沒有更改 Rancher Monitoring 的抓取設定。

GPU 叢集的 `pk-3060`、`pk-5090` 主機使用 [gpu-cluster-node-exporter.yaml](gpu-cluster-node-exporter.yaml) 透過現有 Kubernetes 管理權限部署唯讀 node exporter；`pk-gpu-pve3`、`pk-3060`、`pk-5090` 使用 [gpu-cluster-gpu-exporter.yaml](gpu-cluster-gpu-exporter.yaml) 採集 GPU。GPU Pod 沿用叢集的 NVIDIA RuntimeClass 和裝置外掛所需的 `SYS_ADMIN` capability，但**不請求 `nvidia.com/gpu`**，不占用使用者的 GPU 配額，也不更改叢集 Prometheus。

網站可直接讀取 `pk-3060` 與 `pk-gpu-pve3`；`pk-5090` 的連線受網路限制，使用 cc3 VM 上的 [relay_metrics.py](relay_metrics.py) 在受限 9300／9301 連接埠轉送。node 與 GPU 轉送均從叢集 API 對本機 loopback [port-forward](gpu_portforward.py)，不開放新的跨網段連接埠。來源網路 ACL 與 CPU／GPU 既有 exporter 相同，`hpclab-node-relay.service`、`hpclab-gpu-relay.service`、`hpclab-node-portforward.service` 和 `hpclab-gpu-portforward.service` 均開機啟動。

GPU VM 的 `capacityHostId` 對應實體主機，VM 自己只顯示 CPU／RAM；總算力沿用清冊，不把 VM 資源再加一次。無法拉取的筆電改用 HTTPS push，兩個 exporter 只綁 loopback，token 僅存遠端受限檔案與網站 Kubernetes Secret。

A100 MIG 與 Jetson 的專用採集方式見 [SPECIALIZED.md](SPECIALIZED.md)。工具已備妥不代表該機器已安裝；仍需實際管理權限與採樣驗證。
