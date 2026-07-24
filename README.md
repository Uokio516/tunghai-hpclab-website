# HPC Lab 官網 · hpclab.thu.edu.tw

東海大學 資訊工程學系 高效能計算實驗室 (Prof. 楊朝棟) 官方網站，
含實驗室介紹、聯絡表單，以及 **叢集基礎設施即時監控頁**。

- 🌐 首頁：<https://hpclab.thu.edu.tw>
- 📊 叢集狀態：<https://hpclab.thu.edu.tw/infrastructure>

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | React 19 · Vite 6 · React Router 7 · TailwindCSS 4 · Motion |
| 後端 | Express (`server.ts`，用 `tsx` 執行) |
| 資料 | SQLite（聯絡表單留言） |
| 部署 | Docker → Kubernetes (RKE2, pk-cluster) · ingress-nginx + cert-manager |

## 頁面 / 路由

| 路由 | 說明 |
|------|------|
| `/` | 首頁（Hero、研究領域、成果、聯絡表單） |
| `/infrastructure` | 叢集基礎設施狀態（CubeCOS / Proxmox / PBS） |
| `/admin` | 留言管理（需管理密碼） |

## API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/contact` | POST | 送出聯絡留言（公開） |
| `/api/messages` | GET/PUT/DELETE | 留言管理（需 `X-Admin-Password` 標頭） |
| `/api/cluster-status` | GET | 叢集狀態 JSON（唯讀，**不含任何叢集憑證**） |

## 本機開發

需求：Node.js 20+

```bash
npm install
# 選用：cp .env.example .env 並填入 GEMINI_API_KEY
npm run dev          # http://localhost:3000
```

## 叢集監控頁如何運作

`/infrastructure` 前端每 30 秒抓 `/api/cluster-status`。後端回傳的資料來源：

1. `data/cluster-status.json`（掛載的 volume，若存在則優先）
2. `cluster-status.default.json`（打包在 image 內的預設快照）

> 設計原則：對外網站**不持有**任何叢集管理密碼；狀態只是一份 JSON 快照。
> 要更新數字時，改 JSON 即可（見下）。未來可由背景收集器定時寫入 `data/cluster-status.json` 變成即時。

### 更新叢集狀態數據

- **只改數字（免重建 image）**：更新 volume 上的 `data/cluster-status.json`，網站立即生效。
- **永久保留**：改 `cluster-status.default.json` → 重建 image 重新部署。

## 建置與部署

```bash
# 建置並推送 image（Docker Hub: pokai516/hpc-lab）
docker build --platform linux/amd64 --provenance=false -t pokai516/hpc-lab:latest .
docker push pokai516/hpc-lab:latest

# 於 pk-cluster 滾動更新
kubectl --context pk-cluster -n default rollout restart deployment hpc-lab-site
```

部署細節見 [DEPLOY-monitoring.md](DEPLOY-monitoring.md)。K8s 資源定義見 [k8s-deploy.yaml](k8s-deploy.yaml)。

## 專案結構

```
├── server.ts                    Express 伺服器 + API
├── src/
│   ├── App.tsx                  路由與首頁
│   └── components/
│       ├── AdminPanel.tsx       留言管理頁
│       └── Infrastructure.tsx   叢集監控頁
├── cluster-status.default.json  叢集狀態預設快照
├── Dockerfile · k8s-deploy.yaml 部署設定
```

## 備註

- SQLite 資料庫（`database.sqlite`）與 `.env` 已列入 `.gitignore`，不進版控。
- `ADMIN_PASSWORD` 請以環境變數設定，勿使用程式內建預設值。
