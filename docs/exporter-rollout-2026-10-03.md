# 實驗室監控擴充紀錄（2026-10-03）

網站監控每 5 秒採集一次，超過 120 秒的 GPU 數值不顯示為即時使用率。清冊容量維持 22 張 GPU、401 GB 顯存、29 台實體計算機器、880 CPU 緒與 3.5 TB RAM；直通 GPU 的 VM 監控數值歸在實體主機，容量不重複計算。兩個網站 Pod 均已驗證 **20／22 張 GPU 有即時遙測**；仍缺 A100 與 pve4 直通 VM 的 RTX 2080 Ti。

## 已接入

| 類別 | 機器 | 處理方式 |
| --- | --- | --- |
| 原有獨立 Prometheus | inv-02、03、05、06、07、08、11、14 | 保留原有 node／GPU 指標與 15 秒採集設定 |
| 原有 exporter，新增網站讀取權限 | inv-10、12 | 保留既有服務及原防火牆規則，只讓網站節點額外讀取 |
| 新增 node 與 NVIDIA GPU exporter | inv-09、13、25、27、52、53、54 | 每 5 秒 GPU 採樣；VM 52–54 的 GPU 指標歸入主機 37–39 |
| 新增 node exporter | inv-40–46、49–51、55–56 | 提供 CPU 與 RAM 即時數值；未變更 GPU 驅動或直通設定 |
| GPU 叢集新增 node exporter | inv-58、72 | 以既有 Kubernetes 管理權限在兩台節點唯讀採集 CPU／RAM；第二台經 inv-54 的受限轉送服務接入網站 |
| GPU 叢集新增 GPU exporter | inv-42、58、72 | 透過既有 NVIDIA 執行環境採集真實使用率，不保留 GPU 資源；inv-42 的 RTX 2060 實際由直通 VM 讀取並歸入實體主機 |

透過 SSH 新裝 19 台 node exporter，其中 7 台另裝 NVIDIA GPU exporter。inv-25 因網站所在網路無法連入該筆電，改由筆電每 5 秒用具驗證的 HTTPS 上傳；服務只監聽本機。透過 SSH 安裝的 exporter 使用來源白名單，允許既有獨立 Prometheus 和網站 Kubernetes 節點讀取。GPU 叢集另外部署兩台 node exporter 與三台 GPU exporter；未更改 Rancher Monitoring／Prometheus 抓取設定。

## 尚需登入資料或主機管理管道

| 機器 | 原因 |
| --- | --- |
| inv-04（A100 MIG） | 清冊所列 SSH 帳密無法登入；專用 MIG exporter 已備妥，尚未裝到實機 |
| inv-37–39（CubeCOS 實體主機） | SSH 帳密無法登入；目前可由既有 VM 52–54 取得直通 GPU 遙測 |
| inv-47（Proxmox Backup Server） | 清冊帳密失效，尚無 node exporter |
| inv-66、68（Jetson） | 清冊未提供可用登入資料；Jetson 專用唯讀 exporter 已備妥，尚未裝到實機 |
| inv-48（WireGuard VM） | 可登入但沒有管理權限，無法安裝持續執行的服務 |
| pve4 VM115（RTX 2080 Ti） | VM 在運作，GPU 已直通；沒有可用 guest agent 或已知可用登入帳密，宿主機無法讀取 VM 內的 GPU 使用率 |

請在本機 `HPC Device List.xlsx` 更新相關機器的帳密，或提供可用的既有管理方式。帳密不寫入專案、監控資料、網站 API 或本紀錄。

## 操作與驗證

腳本、版本及重跑方式見 [exporter README](../tools/exporters/README.md)。每台安裝後確認 systemd active、`node_cpu_seconds_total` 與 `nvidia_smi_gpu_info`；每個網站 Pod 逐一確認可讀指標。伺服器端目標設定在 [exporter-targets.default.json](../exporter-targets.default.json)，機器位址只供伺服器使用，瀏覽器 API 不回傳目標 URL、IP 或連接埠。
