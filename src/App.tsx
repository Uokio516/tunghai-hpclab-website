import { motion, AnimatePresence, MotionConfig } from "motion/react";
import React, { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const AdminPanel = lazy(() =>
  import("./components/AdminPanel").then((m) => ({ default: m.AdminPanel }))
);
const Infrastructure = lazy(() =>
  import("./components/Infrastructure").then((m) => ({ default: m.Infrastructure }))
);
const GpuFleet = lazy(() =>
  import("./components/GpuFleet").then((m) => ({ default: m.GpuFleet }))
);
const HeroPreview = lazy(() =>
  import("./components/HeroPreview").then((m) => ({ default: m.HeroPreview }))
);
const ProjectsPage = lazy(() =>
  import("./components/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage }))
);
const PeoplePage = lazy(() =>
  import("./components/pages/PeoplePage").then((m) => ({ default: m.PeoplePage }))
);
const MemberJoinPage = lazy(() => import("./components/pages/MemberPortal").then((m) => ({ default: m.MemberJoinPage })));
const MemberLoginPage = lazy(() => import("./components/pages/MemberPortal").then((m) => ({ default: m.MemberLoginPage })));
const MemberProfilePage = lazy(() => import("./components/pages/MemberPortal").then((m) => ({ default: m.MemberProfilePage })));
const MemberResetPage = lazy(() => import("./components/pages/MemberPortal").then((m) => ({ default: m.MemberResetPage })));
const MemberAdminPage = lazy(() => import("./components/pages/MemberAdminPage").then((m) => ({ default: m.MemberAdminPage })));
const PublicationsPage = lazy(() =>
  import("./components/pages/PublicationsPage").then((m) => ({ default: m.PublicationsPage }))
);
const NewsPage = lazy(() =>
  import("./components/pages/NewsPage").then((m) => ({ default: m.NewsPage }))
);
const ContactPage = lazy(() =>
  import("./components/pages/ContactPage").then((m) => ({ default: m.ContactPage }))
);
const NotFoundPage = lazy(() =>
  import("./components/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage }))
);
const ResearchNetwork3D = lazy(() =>
  import("./components/ResearchNetwork3D").then((m) => ({ default: m.ResearchNetwork3D }))
);
import { Navigation } from "./components/layout/Navigation";
import { Footer } from "./components/layout/Footer";
import { projects } from "./data/projects";
import { publications } from "./data/publications";
import { WebGLBoundary } from "./components/ui/WebGLBoundary";
import { ResearchAreaBanner } from "./components/ResearchAreaBanner";
import { ImmersiveExperience } from "./components/ImmersiveExperience";
import { AmbientAudio } from "./components/AmbientAudio";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3CbQ7bgJl2DosxuagIbrMDX2u4Q/hf_20260503_204926_23a59427-11bb-4fdd-b5ed-cc8f1b16ea02.mp4";
const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55;

type FormStatus = "idle" | "sending" | "success" | "error";

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current opacity-30" style={{ borderTopColor: "transparent", color: "var(--text)" }} />
    </div>
  );
}

/* The hero chunk is large (Three.js). Rather than a spinner on a
   different background — which reads as a second loading screen before
   the hero's own intro — this paints the hero's identity line on the
   hero's own background, so the chunk arriving is a continuation. */
/* Keep content-page loading states in the selected theme. */
function DarkRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      {children}
    </Suspense>
  );
}

function HeroChunkFallback() {
  return (
    <div className="flex min-h-screen items-center px-6 sm:px-10" style={{ background: "#05070b", color: "#f3f4f6" }}>
      <p className="text-xs font-medium uppercase tracking-[0.22em] opacity-60 sm:text-sm">
        HPC Lab · Tunghai University
      </p>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ScrollToSection />
      <AmbientAudio />
      <ImmersiveExperience>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/infrastructure"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Infrastructure />
            </Suspense>
          }
        />
        <Route
          path="/gpus"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GpuFleet />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminPanel />
            </Suspense>
          }
        />
        {/* Not linked in nav — a Three.js hero demo under review, see chat. */}
        <Route
          path="/hero-preview"
          element={
            <Suspense fallback={<HeroChunkFallback />}>
              <HeroPreview />
            </Suspense>
          }
        />

        {/* Content pages reached from the immersive menu. Each is its own
            lazy chunk, so none of them pull Three.js in. */}
        <Route path="/research" element={<Navigate to="/#research" replace />} />
        <Route path="/projects" element={<DarkRoute><ProjectsPage /></DarkRoute>} />
        <Route path="/people" element={<DarkRoute><PeoplePage /></DarkRoute>} />
        <Route path="/join/:invite" element={<DarkRoute><MemberJoinPage /></DarkRoute>} />
        <Route path="/member/login" element={<DarkRoute><MemberLoginPage /></DarkRoute>} />
        <Route path="/member/me" element={<DarkRoute><MemberProfilePage /></DarkRoute>} />
        <Route path="/member/reset/:reset" element={<DarkRoute><MemberResetPage /></DarkRoute>} />
        <Route path="/admin/members" element={<DarkRoute><MemberAdminPage /></DarkRoute>} />
        <Route path="/publications" element={<DarkRoute><PublicationsPage /></DarkRoute>} />
        <Route path="/news" element={<DarkRoute><NewsPage /></DarkRoute>} />
        <Route path="/contact" element={<DarkRoute><ContactPage /></DarkRoute>} />

        {/* Without this, an unmatched path renders nothing at all — a blank
            page, indistinguishable from a crash. */}
        <Route path="*" element={<DarkRoute><NotFoundPage /></DarkRoute>} />
      </Routes>
      </ImmersiveExperience>
    </BrowserRouter>
    </MotionConfig>
  );
}

function ScrollToSection() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    let scrollTimer: ReturnType<typeof setTimeout>;
    const timer = window.setInterval(() => {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        window.clearInterval(timer);
        scrollTimer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 500);
      }
    }, 100);
    const timeout = window.setTimeout(() => window.clearInterval(timer), 5000);
    return () => { window.clearInterval(timer); window.clearTimeout(timeout); clearTimeout(scrollTimer); };
  }, [pathname, hash]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Theme toggle — respects the OS by default, but a click persists an  */
/* explicit choice (data-theme on <html>) that overrides it.           */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Cinematic video hero — two <video> elements crossfade into each     */
/* other just before the loop point, so the background never hard-cuts.*/
/* A dark vignette keeps the type legible over whatever plays behind it.*/
/* ------------------------------------------------------------------ */
function CinematicBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState(1);
  const [opacity1, setOpacity1] = useState(1);
  const [opacity2, setOpacity2] = useState(0);

  useEffect(() => {
    let animationFrame: number;
    let fadeStartTime: number | null = null;
    let isFading = false;

    const crossfade = (timestamp: number) => {
      const vid1 = videoRef1.current;
      const vid2 = videoRef2.current;
      if (!vid1 || !vid2) return;

      const currentVid = activeVideo === 1 ? vid1 : vid2;
      const nextVid = activeVideo === 1 ? vid2 : vid1;

      if (
        !isFading &&
        currentVid.duration > 0 &&
        currentVid.currentTime > currentVid.duration - FADE_OUT_LEAD
      ) {
        isFading = true;
        fadeStartTime = timestamp;
        nextVid.currentTime = 0;
        nextVid.play().catch(() => {});
      }

      if (isFading && fadeStartTime !== null) {
        const elapsed = timestamp - fadeStartTime;
        const progress = Math.min(elapsed / FADE_MS, 1);

        if (activeVideo === 1) {
          setOpacity1(1 - progress);
          setOpacity2(progress);
        } else {
          setOpacity1(progress);
          setOpacity2(1 - progress);
        }

        if (progress === 1) {
          isFading = false;
          fadeStartTime = null;
          currentVid.pause();
          setActiveVideo(activeVideo === 1 ? 2 : 1);
        }
      }

      animationFrame = requestAnimationFrame(crossfade);
    };

    animationFrame = requestAnimationFrame(crossfade);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeVideo]);

  useEffect(() => {
    videoRef1.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onPointerMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty("--hero-x", `${(event.clientX / window.innerWidth - 0.5) * -18}px`);
      root.style.setProperty("--hero-y", `${(event.clientY / window.innerHeight - 0.5) * -12}px`);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  const handleEnded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  };

  return (
    <div ref={rootRef} className="cinematic-backdrop absolute inset-0 overflow-hidden">
      <video ref={videoRef1} src={VIDEO_URL} muted playsInline autoPlay onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover" style={{ opacity: opacity1 }} />
      <video ref={videoRef2} src={VIDEO_URL} muted playsInline onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover" style={{ opacity: opacity2 }} />
      {/* cinematic vignette + brand tint, keeps type legible in both themes */}
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(120% 90% at 15% -10%, transparent 30%, color-mix(in srgb, var(--bg) 55%, transparent) 78%), " +
          "linear-gradient(180deg, color-mix(in srgb, var(--bg) 45%, transparent) 0%, color-mix(in srgb, var(--bg) 78%, transparent) 100%)",
      }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live counts pulled from the lab's own public endpoints — a claim    */
/* the homepage can back up rather than a decorative stat block.       */
/* ------------------------------------------------------------------ */
function useLiveTelemetry() {
  const [gpuOnline, setGpuOnline] = useState<number | null>(null);
  const [gpuBusy, setGpuBusy] = useState<number | null>(null);
  const [nodesOnline, setNodesOnline] = useState<number | null>(null);
  const [gpuTotal, setGpuTotal] = useState<number | null>(null);
  const [endpoints, setEndpoints] = useState<{ up: number; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/gpus", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (!alive) return;
        setGpuOnline(payload?.summary?.gpusOnline ?? null);
        setGpuBusy(payload?.summary?.gpusBusy ?? null);
        setGpuTotal(payload?.summary?.gpusTotal ?? null);
        setEndpoints(payload?.summary?.hostsTotal != null ? { up: payload.summary.hostsUp, total: payload.summary.hostsTotal } : null);
        setNodesOnline(payload?.summary?.machinesTracked ?? null);
      } catch { /* Keep the previous good snapshot until the next poll. */ }
    };
    poll();
    const interval = window.setInterval(poll, 15000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  // Busy count is measured by the API; unknown stays unknown.
  const busyRatio = gpuOnline && gpuBusy != null ? Math.min(1, gpuBusy / gpuOnline) : null;

  return { gpuOnline, gpuBusy, gpuTotal, nodesOnline, endpoints, busyRatio };
}

function LivePill({ status }: { status: string }) {
  return (
    <div className="video-chip inline-flex items-center gap-2.5 px-4 py-2.5">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: "var(--good)" }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--good)" }} />
      </span>
      <span className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "var(--good)" }}>Live</span>
      <span className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>{status}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cursor particle trail — a light homage to Active Theory's glowing   */
/* cursor. A handful of fading dots follow the pointer inside the hero */
/* only; Canvas, not a DOM-per-particle approach, stays cheap.         */
/* ------------------------------------------------------------------ */
function HeroBody({
  live, compact,
}: { live: ReturnType<typeof useLiveTelemetry>; compact?: boolean }) {
  return (
    <div className="text-center">
      <div className={`flex justify-center ${compact ? "mb-5" : "mb-7"}`}>
        <LivePill status={live.gpuOnline != null ? "GPU 監控運行中" : "研究進行中"} />
      </div>

      <h1 className={compact ? "mx-auto max-w-md text-4xl leading-[1.15]" : "mx-auto max-w-3xl text-[clamp(2.75rem,9vw,5.5rem)] leading-[1.1]"}>
        高效能<span style={{ color: "var(--brand-light)" }}>計算</span>實驗室
      </h1>
      <p
        className={`mx-auto mt-4 ${compact ? "max-w-sm text-base" : "max-w-xl text-xl sm:text-2xl"}`}
        style={{ color: "var(--text-dim)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}
      >
        指導教授　楊朝棟　博士
        <span className={`ml-2 not-italic ${compact ? "text-sm" : "text-base"}`} style={{ color: "var(--text-faint)", fontFamily: "var(--font-sans)" }}>
          Prof. Chao-Tung Yang
        </span>
      </p>

      <div className={`flex flex-wrap justify-center gap-2.5 ${compact ? "mt-5" : "mt-8"}`}>
        {["LLM 微調", "K8s 裸機叢集", "多模態", "CubeCOS", "邊緣運算"].map((tag) => (
          <span key={tag} className={`chip font-medium ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-base"}`} style={{ color: "var(--text-dim)" }}>
            {tag}
          </span>
        ))}
      </div>

      <div className={`flex flex-wrap items-center justify-center gap-3 ${compact ? "mt-6" : "mt-10"}`}>
        <a
          href="#contact"
          className={`inline-flex items-center gap-2 rounded-full font-semibold transition-transform active:scale-95 ${compact ? "px-6 py-2.5 text-sm" : "px-7 py-3.5 text-lg"}`}
          style={{ background: "var(--text)", color: "var(--bg)" }}
        >
          聯絡我們 <ArrowUpRight className="h-4 w-4" />
        </a>
        <Link
          to="/gpus"
          className={`inline-flex items-center gap-2 rounded-full font-semibold transition-colors ${compact ? "px-6 py-2.5 text-sm" : "px-7 py-3.5 text-lg"}`}
          style={{ border: "1px solid var(--glass-border)" }}
        >
          查看運算資源
        </Link>
      </div>
    </div>
  );
}

function HomeLiveOverview({ live }: { live: ReturnType<typeof useLiveTelemetry> }) {
  return <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .45, duration: .65 }} className="home-live-overview">
    <div className="home-live-intro"><span className="home-live-kicker"><span /> LIVE LAB</span><strong>實驗室算力，現在的狀態</strong><p>公開的即時遙測與設備盤點。數值來自實際採樣，未接入的機器保留連線狀態。</p></div>
    <div className="home-live-numbers" aria-label="算力即時摘要">
      <div><span>GPU 即時回報</span><strong>{live.gpuOnline ?? "—"}<small> / {live.gpuTotal ?? "—"} 張</small></strong></div>
      <div><span>實體運算機器</span><strong>{live.nodesOnline ?? "—"}<small> 台</small></strong></div>
      <div><span>端點可連線</span><strong>{live.endpoints?.up ?? "—"}<small> / {live.endpoints?.total ?? "—"}</small></strong></div>
    </div>
    <div className="home-live-actions"><Link to="/gpus">查看節點監控 <ArrowUpRight size={16} /></Link><Link to="/infrastructure">叢集基礎設施 <ArrowUpRight size={16} /></Link></div>
  </motion.div>;
}

function Home() {
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [activeResearchId, setActiveResearchId] = useState<string | null>(null);
  const live = useLiveTelemetry();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus("sending");
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        setFormStatus("success");
        (e.target as HTMLFormElement).reset();
        setTimeout(() => setFormStatus("idle"), 6000);
      } else {
        setFormStatus("error");
      }
    } catch {
      setFormStatus("error");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Navigation />

      {/* Hero */}
      <header className="home-hero pt-[76px] relative min-h-[92vh] overflow-hidden">
        <CinematicBackdrop />
        <div className="home-hero-inner relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-20 md:pb-36 md:pt-24">
          <HeroBody live={live} />
          <HomeLiveOverview live={live} />
        </div>
      </header>

      <main className="home-main mx-auto max-w-7xl px-5 sm:px-8">
        {/* Research network — six real research areas as node colors on a
            living network; hovering a node updates the banner beside it
            (no click-through, no page navigation — see
            docs/research-network-redesign.md). */}
        {/* Breaks out of <main>'s max-w-7xl — the interactive scene reads
            as small/cramped confined to the same column width as body
            text. Own wider max-width keeps it from touching screen edges
            on ultra-wide monitors. */}
        <section id="research" className="home-section research-section relative left-1/2 right-1/2 -mx-[50vw] w-screen py-20 sm:py-28">
          <div className="mx-auto max-w-[1800px] px-5 sm:px-8">
            <SectionEyebrow>研究領域</SectionEyebrow>
            <h2 className="mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-tight">
              六大研究領域，相互連結的技術系統
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
              <Suspense
                fallback={<div className="mx-auto aspect-square w-full sm:aspect-[4/3.4]" style={{ background: "var(--surface)" }} />}
              >
                <WebGLBoundary>
                  <ResearchNetwork3D
                    activeId={activeResearchId}
                    onActiveChange={setActiveResearchId}
                    busyRatio={live.busyRatio}
                    onSelect={setActiveResearchId}
                  />
                </WebGLBoundary>
              </Suspense>
              <ResearchAreaBanner
                activeId={activeResearchId}
                onActiveChange={setActiveResearchId}
                onSelect={setActiveResearchId}
              />
            </div>
          </div>
        </section>



        <div className="divider" />

        <section className="home-section py-16 sm:py-24">
          <SectionEyebrow>研究與團隊</SectionEyebrow>
          <h2 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-medium">認識我們的工作</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <SystemLinkCard to="/projects" title="研究專案" desc={`探索 ${projects.length} 項代表性專案與應用成果。`} />
            <SystemLinkCard to="/publications" title="論文著作" desc={`瀏覽目前收錄的 ${publications.length} 篇研究論文與發表資訊。`} />
            <SystemLinkCard to="/people" title="研究成員" desc="認識指導教授、研究團隊與實驗室成員。" />
          </div>
        </section>

        <div className="divider" />

        {/* Contact */}
        <section id="contact" className="home-section py-20 sm:py-28">
          <div className="mx-auto max-w-2xl">
            <div className="mb-10 text-center">
              <SectionEyebrow center>聯絡我們</SectionEyebrow>
              <h2 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-medium">有合作或研究興趣嗎？</h2>
              <p className="mt-4 text-lg" style={{ color: "var(--text-dim)" }}>
                歡迎留言與我們聯繫，我們會盡快回覆。
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="panel p-6 sm:p-10"
            >
              <AnimatePresence mode="wait">
                {formStatus === "success" ? (
                  <motion.div
                    key="success"
                    role="status"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="flex flex-col items-center gap-4 py-12 text-center"
                  >
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ background: "var(--good-soft)", color: "var(--good)" }}
                    >
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-xl font-semibold">留言已送出</p>
                    <p style={{ color: "var(--text-dim)" }}>感謝您的聯絡，我們將盡快回覆。</p>
                    <button
                      onClick={() => setFormStatus("idle")}
                      className="mt-2 text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      再次留言
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-5 text-left"
                    onSubmit={handleSubmit}
                  >
                    <Field label="姓名" name="name" type="text" required placeholder="您的稱呼" disabled={formStatus === "sending"} />
                    <Field label="聯絡信箱" name="email" type="email" required placeholder="email@example.com" disabled={formStatus === "sending"} />
                    <div>
                      <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-dim)" }}>留言內容</label>
                      <textarea
                        id="contact-message"
                        name="message"
                        required
                        rows={4}
                        disabled={formStatus === "sending"}
                        placeholder="請描述您的需求"
                        className="w-full resize-none rounded-xl px-4 py-3.5 text-base transition-colors focus:outline-none disabled:opacity-50"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                    </div>

                    {formStatus === "error" && (
                      <p role="alert" className="text-center text-sm" style={{ color: "var(--critical)" }}>
                        發送失敗，請稍後再試。
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={formStatus === "sending"}
                      className="w-full rounded-full py-4 text-base font-semibold transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "var(--brand)", color: "var(--ink)" }}
                    >
                      {formStatus === "sending" ? "傳送中…" : "傳送留言"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function SectionEyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p
      className={`text-sm font-bold uppercase tracking-[0.18em] ${center ? "" : ""}`}
      style={{ color: "var(--brand)" }}
    >
      {children}
    </p>
  );
}

function SystemLinkCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="group">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="panel flex h-full flex-col justify-between gap-6 p-7 transition-colors"
      >
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold not-italic">{title}</h3>
            <ArrowUpRight
              className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              style={{ color: "var(--brand)" }}
            />
          </div>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{desc}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
          {to === "/gpus" && <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: "var(--good)" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--good)" }} />
          </span>}
          {to === "/gpus" ? "即時監控" : to === "/infrastructure" ? "資源盤點" : "瀏覽內容"}
        </div>
      </motion.div>
    </Link>
  );
}

function Field({
  label,
  name,
  type,
  required,
  placeholder,
  disabled,
}: {
  label: string; name: string; type: string; required?: boolean; placeholder?: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{label}</label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3.5 text-base transition-colors focus:outline-none disabled:opacity-50"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </div>
  );
}
