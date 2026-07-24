import { AnimatePresence, motion } from "motion/react";
import { Command, CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const destinations = [
  { label: "首頁", hint: "返回運算核心", path: "/", aliases: "home core 首頁" },
  { label: "研究領域", hint: "探索六大研究方向", path: "/research", aliases: "research 研究" },
  { label: "GPU 機房", hint: "查看即時 GPU 遙測", path: "/gpus", aliases: "gpu fleet 機房" },
  { label: "叢集基礎設施", hint: "CubeCOS 與 Proxmox", path: "/infrastructure", aliases: "cluster infra 叢集" },
  { label: "研究專案", hint: "查看實驗室成果", path: "/projects", aliases: "projects 專案" },
  { label: "研究團隊", hint: "認識實驗室成員", path: "/people", aliases: "people team 成員" },
  { label: "論文發表", hint: "瀏覽 Publications", path: "/publications", aliases: "papers publications 論文" },
  { label: "最新消息", hint: "查看 News", path: "/news", aliases: "news 最新消息" },
  { label: "聯絡我們", hint: "傳送訊息", path: "/contact", aliases: "contact 聯絡" },
];

function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const seen = sessionStorage.getItem("hpclab-core-awake");
    if (seen === "done") return;
    sessionStorage.setItem("hpclab-core-awake", "booting");
    setVisible(true);
    const steps = [window.setTimeout(() => setPhase(1), 420), window.setTimeout(() => setPhase(2), 900)];
    const done = window.setTimeout(() => {
      sessionStorage.setItem("hpclab-core-awake", "done");
      setVisible(false);
    }, 1850);
    return () => [...steps, done].forEach(window.clearTimeout);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="boot-sequence"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
          transition={{ duration: 0.65 }}
        >
          <div className="boot-grid" />
          <motion.div className="boot-core" animate={{ scale: phase === 2 ? [1, 1.2, 0.88] : 1 }} />
          <div className="boot-copy">
            <div className="boot-kicker">THU · HIGH PERFORMANCE COMPUTING LABORATORY</div>
            <div className="boot-status">
              {phase === 0 ? "INITIALIZING COMPUTE FABRIC" : phase === 1 ? "SYNCHRONIZING TELEMETRY" : "CORE ONLINE"}
              <span className="terminal-cursor">_</span>
            </div>
            <div className="boot-track"><motion.span animate={{ width: `${(phase + 1) * 33.34}%` }} /></div>
          </div>
          <button className="boot-skip" onClick={() => setVisible(false)}>SKIP INTRO</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandInterface() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if ((event.key === "/" && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80);
    else setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? destinations.filter((d) => `${d.label} ${d.hint} ${d.aliases}`.toLowerCase().includes(q)) : destinations;
  }, [query]);

  const select = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button className="command-trigger" onClick={() => setOpen(true)} aria-label="開啟快速指令">
        <Command className="h-4 w-4" /><span>COMMAND</span><kbd>/</kbd>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setOpen(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="HPC Lab 快速指令"
              className="command-panel"
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="command-input-row">
                <Search className="h-5 w-5" />
                <span>&gt;</span>
                <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="輸入目的地，例如 GPU、研究、團隊…" />
                <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
              </div>
              <div className="command-results">
                {results.map((item, index) => (
                  <button key={item.path} onClick={() => select(item.path)} autoFocus={index === 0}>
                    <span className="command-index">{String(index + 1).padStart(2, "0")}</span>
                    <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                    <CornerDownLeft className="h-4 w-4" />
                  </button>
                ))}
                {!results.length && <p className="command-empty">NO DESTINATION FOUND</p>}
              </div>
              <div className="command-footer"><span>ESC 關閉</span><span>ENTER 選擇</span><span>HPC LAB INTERFACE v1.0</span></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function InteractionSound() {
  const contextRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const play = (frequency: number, duration: number, volume: number) => {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const context = contextRef.current ?? new AudioCtx();
      contextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    };
    let lastHover = 0;
    const onOver = (event: PointerEvent) => {
      if (localStorage.getItem("hpclab-audio") !== "on") return;
      if (!(event.target as Element).closest("a,button,[role='button']") || performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      play(520, 0.055, 0.012);
    };
    const onDown = (event: PointerEvent) => {
      if (localStorage.getItem("hpclab-audio") !== "on") return;
      if ((event.target as Element).closest("a,button,[role='button']")) play(230, 0.11, 0.02);
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
      contextRef.current?.close();
    };
  }, []);
  return null;
}

export function ImmersiveExperience({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <>
      <BootSequence />
      <InteractionSound />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className="route-stage"
          initial={{ opacity: 0, scale: 1.012, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.992, filter: "blur(8px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <div className="route-scanline" aria-hidden="true" />
      <CommandInterface />
    </>
  );
}
