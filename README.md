# Tunghai HPC Lab — Website · 東海大學高效能計算實驗室官網

**高效能計算實驗室 · 東海大學資訊工程學系 (Prof. 楊朝棟 / Chao-Tung Yang)**

🔗 **Live / 線上：** <https://hpclab.thu.edu.tw>

**English** ｜ **[中文](#中文版)**

---

## What it is

An immersive website for the High Performance Computing Laboratory at Tunghai
University — part public face of the lab, part live window into the real GPU
and cluster infrastructure we run.

The lab studies high-performance / distributed computing, cloud, big data, AI
and AIoT. Most academic-lab sites are a static page of publications; I wanted
ours to *show* the systems, not just describe them — so the site pulls real
data from the monitoring stack running on our own machines, wrapped in an
interactive 3D experience.

## Features

### Live, real data

- **GPU fleet monitoring** — real-time utilisation, temperature, power and VRAM
  for the lab's GPU workstations, queried **server-side from a Prometheus
  instance I set up across the machines**. Real numbers from real hardware, not
  placeholders. Internal IPs are never sent to the browser.

### Snapshot (and honestly labelled as such in the UI)

- **Cluster infrastructure overview** — CubeCOS / OpenStack, Proxmox and the
  backup server. A **point-in-time inventory snapshot** (the date is shown on
  the page), **not** a live feed, because I don't yet have read-only API tokens
  for those platforms. I won't present a snapshot as if it were live, so the UI
  says so plainly.

### Experience

- Interactive **3D research network** (React Three Fiber) — colour-coded nodes
  you can drag to rotate, with a slot-reel banner that rolls to each research
  area on hover.
- Immersive intro sequence, route transitions, and a **⌘/Ctrl-K command palette**.
- **In-browser generative background music** (Web Audio API) — synthesised live,
  no audio files and no licensing; the tempo follows the real GPU load.
- Full **light/dark theming**, **mobile-responsive** across every route, and
  accessibility throughout (reduced-motion, keyboard navigation, focus states).

## Tech stack

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

## Architecture

- **Frontend** — React + Vite SPA; the heavy Three.js scenes are code-split so
  they never weigh down the initial load.
- **Backend** — a small Express server (`server.ts`) that serves the app,
  handles the contact form (SQLite), and proxies read-only Prometheus queries
  for `/api/gpus` so no monitoring credentials or internal addresses reach the
  client.
- **Deployment** — built into a Docker image and deployed to a self-hosted
  Kubernetes (RKE2) cluster behind a TLS ingress.

## How this was built — honest disclosure

I care a lot about being upfront, so here's the real split.

**Me (the human):**

- I built and operate the **monitoring stack this site reads from** — Prometheus
  plus node/GPU exporters deployed across the lab's GPU machines — and I work
  with the clusters it displays (CubeCOS/OpenStack, Proxmox, PBS).
- I set the product direction, made the design and UX decisions, **verified all
  factual content** (the professor's real publications, research areas, etc.),
  drove every iteration, and own the deployment.

**AI-assisted (Claude + GPT):**

- Most of the **application / frontend code** was written in collaboration with
  **Claude (Anthropic)** and **GPT (OpenAI)** — as pair-programming and design
  partners that I directed and reviewed.
- They also helped with debugging, copywriting and content drafting.

This project is **openly AI-assisted**, and I think that's both normal and worth
being honest about.

## Running locally

```bash
cp .env.example .env      # fill in the values (see below)
npm install
npm run dev               # Express + Vite on http://localhost:3000
```

## Configuration

All secrets and environment-specific values are **env-only** — nothing is
hardcoded and nothing sensitive is committed. See [`.env.example`](.env.example):

| Variable         | Purpose                                                         |
| ---------------- | -------------------------------------------------------------- |
| `ADMIN_PASSWORD` | Password for the `/admin` panel (required; fails closed).      |
| `PROMETHEUS_URL` | Prometheus base URL for `/api/gpus` (required for monitoring). |
| `GEMINI_API_KEY` | Optional, for Gemini API calls.                                |

## License

For reference / portfolio use. The lab's real content, branding and data belong
to the High Performance Computing Laboratory, Tunghai University.

---

<a name="中文版"></a>

## 中文版

**[English](#tunghai-hpc-lab--website--東海大學高效能計算實驗室官網)** ｜ **中文**

### 這是什麼

東海大學資訊工程學系高效能計算實驗室的官方網站——一半是實驗室的對外門面,
一半是我們自己維運的 GPU 與叢集基礎設施的即時視窗。

實驗室的研究方向涵蓋高效能／分散式運算、雲端、大數據、AI 與 AIoT。多數學術
實驗室的網站只是一頁靜態的論文清單;我希望我們的網站能「展示」這些系統,而不
只是描述它——所以網站會從我們自己機器上的監控系統抓真實資料,再包裝成一個
可互動的 3D 體驗。

### 功能

#### 即時、真實的資料

- **GPU 機房監控**——實驗室 GPU 工作站的即時使用率、溫度、功耗與顯存,由
  **我自己在機器上架設的 Prometheus** 在伺服器端查詢而來。是真實硬體的真實
  數字,不是裝飾用的假數據。內網 IP 絕不會傳到瀏覽器。

#### 快照(而且在 UI 上誠實標明)

- **叢集基礎設施總覽**——CubeCOS / OpenStack、Proxmox 與備份伺服器。這是一份
  **某個時間點的盤點快照**(頁面上有標日期),**不是**即時串流,因為我還沒
  取得那些平台的唯讀 API token。我不會把快照當成即時的來呈現,所以 UI 上有
  明確標示。

#### 體驗

- 可互動的 **3D 研究網絡**(React Three Fiber)——不同顏色的節點,可用滑鼠
  拖曳旋轉,搭配一個會像拉霸機一樣滾動到對應研究領域的說明面板。
- 沉浸式開場、路由轉場,以及 **⌘/Ctrl-K 快捷命令面板**。
- **瀏覽器即時合成的背景音樂**(Web Audio API)——即時合成,沒有音檔、沒有
  版權問題;節奏還會跟著真實的 GPU 負載變化。
- 完整的**明暗主題**、全站**響應式(手機/平板/桌機)**,以及全程的無障礙
  設計(尊重 reduced-motion、鍵盤操作、focus 狀態)。

### 技術棧

`React 19` · `TypeScript` · `Vite` · `React Router` · `TailwindCSS` ·
`Three.js / React Three Fiber` · `Framer Motion` · `Express` · `SQLite` ·
`Docker` · `Kubernetes (RKE2)` · `Prometheus`

### 架構

- **前端**——React + Vite SPA;較重的 Three.js 場景做了 code-split,不會拖累
  首頁載入。
- **後端**——一個精簡的 Express 伺服器(`server.ts`),負責提供網站、處理
  聯絡表單(SQLite),並在伺服器端代理唯讀的 Prometheus 查詢給 `/api/gpus`,
  讓任何監控憑證或內網位址都不會到達瀏覽器端。
- **部署**——打包成 Docker image,部署到自架的 Kubernetes(RKE2)叢集,前面
  有 TLS ingress。

### 這個專案是怎麼做出來的 — 誠實說明

我很在意誠實,所以把真實分工寫清楚。

**我(人)做的:**

- 這個網站讀取的**監控系統是我自己架設並維運的**——在實驗室的 GPU 機器上
  部署 Prometheus 與 node/GPU exporter——我也實際維運它所顯示的那些叢集
  (CubeCOS/OpenStack、Proxmox、PBS)。
- 產品方向、設計與 UX 決策、**所有內容真實性的查證**(教授的真實論文、研究
  領域等)、每一次迭代的推動,以及部署,都是我負責。

**AI 協助的部分(Claude + GPT):**

- 大部分的**前端／應用程式碼**,是與 **Claude(Anthropic)** 和
  **GPT(OpenAI)** 協作寫成的——當作我指導並審查的結對程式/設計夥伴。
- 它們也協助除錯、文案與內容草稿。

這個專案是**公開承認由 AI 協作完成的**,我認為這既正常、也值得誠實說明。

### 本機執行

```bash
cp .env.example .env      # 填入設定值(見下)
npm install
npm run dev               # Express + Vite,http://localhost:3000
```

### 設定

所有機密與環境相關的值都**只透過環境變數**提供——沒有任何寫死、也沒有把敏感
資訊進版控。詳見 [`.env.example`](.env.example):

| 變數             | 用途                                                    |
| ---------------- | ------------------------------------------------------- |
| `ADMIN_PASSWORD` | `/admin` 管理頁密碼(必填;未設定則一律拒絕登入)。      |
| `PROMETHEUS_URL` | `/api/gpus` 查詢的 Prometheus 位址(監控功能必填)。    |
| `GEMINI_API_KEY` | 選用,供 Gemini API 呼叫。                               |

### 授權

僅供參考／作品集用途。實驗室的真實內容、品牌與資料版權屬於東海大學高效能計算
實驗室。
