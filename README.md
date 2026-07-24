# Tunghai HPC Lab — Website

**高效能計算實驗室 · 東海大學資訊工程學系 (Prof. 楊朝棟 / Chao-Tung Yang)**

An immersive website for the High Performance Computing Laboratory at Tunghai
University — part public face of the lab, part live window into the real GPU
and cluster infrastructure we run.

🔗 **Live:** <https://hpclab.thu.edu.tw>

---

## What it is

The lab studies high-performance / distributed computing, cloud, big data, AI
and AIoT. Most academic-lab sites are a static page of publications; I wanted
ours to *show* the systems, not just describe them — so the site pulls real
data from the monitoring stack running on our own machines, wrapped in an
interactive 3D experience.

## Features

### Live, real data

- **GPU fleet monitoring** — real-time utilisation, temperature, power and VRAM
  for the lab's GPU workstations, queried **server-side from a Prometheus
  instance I set up across the machines**. These are real numbers from real
  hardware, not placeholders. Internal IPs are never sent to the browser.

### Snapshot (and honestly labelled as such in the UI)

- **Cluster infrastructure overview** — CubeCOS / OpenStack, Proxmox and the
  backup server. This is a **point-in-time inventory snapshot** (the date is
  shown on the page), **not** a live feed, because I don't yet have read-only
  API tokens for those platforms. I won't present a snapshot as if it were
  live, so the UI says so plainly.

### Experience

- Interactive **3D research network** (React Three Fiber) — colour-coded nodes
  you can drag to rotate, with a slot-reel banner that rolls to each research
  area on hover.
- Immersive intro sequence, route transitions, and a **⌘/Ctrl-K command
  palette**.
- **In-browser generative background music** (Web Audio API) — synthesised
  live, so there are no audio files and no licensing to worry about; the tempo
  follows the real GPU load.
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
  for `/api/gpus` so no monitoring credentials or internal addresses ever reach
  the client.
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
