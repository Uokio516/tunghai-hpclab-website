# Tunghai HPC Lab — Website · 東海大學高效能計算實驗室官網

**高效能計算實驗室 · 東海大學資訊工程學系 (Prof. 楊朝棟 / Chao-Tung Yang)**

🔗 **Live / 線上：** <https://hpclab.thu.edu.tw>

**English** ｜ **[中文](#中文版)**

---

## What it is

The website for our lab at Tunghai University. Instead of the usual static
"here are our publications" page, I wanted it to actually *show* the systems we
run — so it pulls live data from our own monitoring and wraps it in an
interactive 3D interface.

The clusters and monitoring behind it are mine: I set up the Prometheus +
exporter monitoring across the lab's GPU machines, and I build and run the
CubeCOS (OpenStack) and Proxmox clusters it reports on. So the site is really a
front-end for infrastructure I put together myself.

## Features

- **Live GPU monitoring** — real utilisation, temperature, power and VRAM from
  the lab's GPU machines, via a Prometheus setup I run. Real numbers, not filler
  (and internal IPs never reach the browser).
- **Cluster overview** — CubeCOS/OpenStack, Proxmox and the backup server. This
  one is a dated snapshot (you can see the date in the UI), not live yet — I
  don't have read-only API tokens for those platforms.
- A draggable **3D research network**, a slot-reel info panel, a **⌘/Ctrl-K
  command palette**, an intro sequence, and **generative background music**
  (Web Audio — no audio files) whose tempo tracks the GPU load.
- Light/dark themes, responsive on mobile, and keyboard / reduced-motion
  friendly.

## Tech

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

The frontend is a code-split Vite SPA; a small Express server serves it, handles
the contact form (SQLite), and proxies read-only Prometheus queries so no
monitoring credentials touch the client. It ships as a Docker image on a
self-hosted Kubernetes cluster behind a TLS ingress.

## Run it

```bash
cp .env.example .env      # fill in the values
npm install
npm run dev               # http://localhost:3000
```

Config is env-only (`.env.example`): `ADMIN_PASSWORD`, `PROMETHEUS_URL`,
`GEMINI_API_KEY`.

## Notes

Built with a lot of help from Claude and GPT. Nothing sensitive is committed —
passwords and internal addresses live in environment variables only.

---

<a name="中文版"></a>

## 中文版

**[English](#tunghai-hpc-lab--website--東海大學高效能計算實驗室官網)** ｜ **中文**

### 這是什麼

我們東海大學實驗室的官網。與其做一頁「這是我們的論文」的靜態頁,我想讓它真的
把我們在跑的系統**展示**出來——所以它會抓我們自己監控的即時資料,再包成一個
可互動的 3D 介面。

網站背後的叢集與監控都是我自己建起來的:實驗室 GPU 機器上的 Prometheus 與
exporter 監控是我架設的,它所呈現的 CubeCOS(OpenStack)與 Proxmox 叢集,也是
我在建置與維運。所以這個網站其實就是我自己搭起來的基礎設施的前端。

### 功能

- **即時 GPU 監控**——實驗室 GPU 機器的真實使用率、溫度、功耗與顯存,來自我
  自己架的 Prometheus。真實數字,不是填版面用的(而且內網 IP 不會傳到瀏覽器)。
- **叢集總覽**——CubeCOS/OpenStack、Proxmox 與備份伺服器。這頁是有標日期的
  快照(UI 上看得到),還不是即時的——那些平台我還沒拿到唯讀 API token。
- 可拖曳的 **3D 研究網絡**、拉霸式資訊面板、**⌘/Ctrl-K 命令面板**、開場動畫,
  還有**即時合成的背景音樂**(Web Audio,無音檔),節奏會跟著 GPU 負載跑。
- 明暗主題、手機響應式,對鍵盤與 reduced-motion 友善。

### 技術

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

前端是 code-split 的 Vite SPA;一個精簡的 Express 伺服器負責提供網站、處理
聯絡表單(SQLite),並代理唯讀的 Prometheus 查詢,讓任何監控憑證都不會到達
瀏覽器端。整包成 Docker image,跑在自架的 Kubernetes 叢集上,前面有 TLS ingress。

### 本機執行

```bash
cp .env.example .env      # 填入設定值
npm install
npm run dev               # http://localhost:3000
```

設定都只走環境變數(`.env.example`):`ADMIN_PASSWORD`、`PROMETHEUS_URL`、
`GEMINI_API_KEY`。

### 備註

大部分是靠 Claude 跟 GPT 幫忙做出來的。沒有任何機密進版控——密碼和內網位址
都只放在環境變數裡。
