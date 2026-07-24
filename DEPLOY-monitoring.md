# 叢集監控頁 — 部署說明

2026-07-21 新增「叢集狀態」頁(`/infrastructure`),顯示 CubeCOS + Proxmox 的設備與健康總覽。

## 這次改了什麼
- `server.ts` — 新增 `GET /api/cluster-status`(唯讀,**不含任何叢集密碼**;讀 `data/cluster-status.json`,無則回退 `cluster-status.default.json`)。
- `src/components/Infrastructure.tsx` — 新頁面(暗色玻璃風,每 30 秒自動更新)。
- `src/App.tsx` — 新增路由 `/infrastructure` + 導覽列「叢集狀態」連結。
- `cluster-status.default.json` — 內建的叢集快照資料(可改)。

> 註:本機 `D:\code\hpc-lab` 原本落後線上版,已同步到線上部署版後才加功能;舊檔備份在 `.backup-*/`。

## 已驗證
`docker build` 成功、`vite build` 通過、容器實跑 `/api/cluster-status` 回傳正常、`/infrastructure` HTTP 200。

## 部署(需要 Docker Hub 帳號 pokai516)
```powershell
cd D:\code\hpc-lab
docker login                     # 登入 pokai516
docker build --platform linux/amd64 --provenance=false -t pokai516/hpc-lab:latest .
docker push pokai516/hpc-lab:latest
```
接著在 pk-cluster 重新滾動部署(讓它拉新 image):
```bash
kubectl -n default rollout restart deployment hpc-lab-site
```
完成後開 https://hpclab.thu.edu.tw/infrastructure 檢查。

## 之後要「真即時」的話(下一步)
現在是**快照模式**(顯示 2026-07-21 實測值)。要即時的話,寫一支背景收集器(cron/CronJob),
定時去抓 Prometheus / Proxmox API / OpenStack,把結果寫成 `data/cluster-status.json`
(對應 hostPath volume `/var/lib/hpc-lab-data`),網站就會自動顯示最新值 —— **網站本身仍不需持有任何叢集密碼**。
