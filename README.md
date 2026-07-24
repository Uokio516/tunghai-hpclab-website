# Tunghai HPC Lab — Website · 東海大學高效能計算實驗室官網

**高效能計算實驗室 · 東海大學資訊工程學系 (Prof. 楊朝棟 / Chao-Tung Yang)**

🔗 **Live / 線上：** <https://hpclab.thu.edu.tw>

**English** ｜ **[中文](#中文版)**

---

## Overview

The website for our lab at Tunghai University. Rather than a static list of
publications, it's designed to *show* the systems the lab works with —
surfacing live data from our own monitoring through an interactive 3D interface.

## Features

- **Live GPU monitoring** — real-time utilisation, temperature, power and VRAM
  for the lab's GPU workstations, served from a Prometheus deployment on the
  machines. Real figures from real hardware; internal addresses are never
  exposed to the client.
- **Cluster overview** — CubeCOS / OpenStack, Proxmox and the backup server.
  This is a dated inventory snapshot (the date is shown in the UI) rather than a
  live feed, as read-only API access to those platforms isn't in place yet.
- An interactive **3D research network**, a slot-reel information panel, a
  **⌘/Ctrl-K command palette**, an intro sequence, and generative background
  music (Web Audio) whose tempo follows the GPU load.
- Light/dark themes, responsive layouts, and accessibility throughout
  (reduced-motion, keyboard navigation, focus states).

## Tech

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

The frontend is a code-split Vite SPA. A small Express server serves it, handles
the contact form (SQLite), and proxies read-only Prometheus queries so that no
monitoring credentials reach the client. It ships as a Docker image on a
self-hosted Kubernetes cluster behind a TLS ingress.

## Running locally

```bash
cp .env.example .env      # fill in the values
npm install
npm run dev               # http://localhost:3000
```

Configuration is env-only (`.env.example`): `ADMIN_PASSWORD`, `PROMETHEUS_URL`,
`GEMINI_API_KEY`.

## Notes

Developed with the assistance of Claude and GPT. Nothing sensitive is committed
— credentials and internal addresses live only in environment variables.

---

<a name="中文版"></a>

## 中文版

**[English](#tunghai-hpc-lab--website--東海大學高效能計算實驗室官網)** ｜ **中文**

### 概覽

東海大學實驗室的官方網站。比起一頁靜態的論文列表,它更希望能「展示」實驗室
所使用的系統——透過一個可互動的 3D 介面,呈現來自我們自己監控系統的即時資料。

### 功能

- **即時 GPU 監控**——實驗室 GPU 工作站的即時使用率、溫度、功耗與顯存,由
  機器上的 Prometheus 提供。真實硬體的真實數字;內網位址不會傳到瀏覽器端。
- **叢集總覽**——CubeCOS / OpenStack、Proxmox 與備份伺服器。這是一份標有
  日期的盤點快照(UI 上可見),而非即時串流,因為目前尚未取得那些平台的唯讀
  API 存取權。
- 可互動的 **3D 研究網絡**、拉霸式資訊面板、**⌘/Ctrl-K 命令面板**、開場動畫,
  以及節奏會跟隨 GPU 負載的即時合成背景音樂(Web Audio)。
- 明暗主題、響應式版面,以及全程的無障礙設計(reduced-motion、鍵盤操作、
  focus 狀態)。

### 技術

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

前端是 code-split 的 Vite SPA。一個精簡的 Express 伺服器負責提供網站、處理
聯絡表單(SQLite),並代理唯讀的 Prometheus 查詢,讓任何監控憑證都不會到達
瀏覽器端。整包成 Docker image,部署在自架的 Kubernetes 叢集上,前面有 TLS ingress。

### 本機執行

```bash
cp .env.example .env      # 填入設定值
npm install
npm run dev               # http://localhost:3000
```

設定皆透過環境變數(`.env.example`):`ADMIN_PASSWORD`、`PROMETHEUS_URL`、
`GEMINI_API_KEY`。

### 備註

本專案在 Claude 與 GPT 的協助下開發。沒有任何機密進版控——憑證與內網位址
僅存在於環境變數中。
