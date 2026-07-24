import { useEffect, useRef } from "react";

/* Lightweight continuous background animation — a breathing dot grid,
   canvas 2D (no WebGL dependency needed for the maintenance page).
   Pauses when the tab is hidden and respects prefers-reduced-motion. */
export function TelemetryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let dots: { x: number; y: number; phase: number }[] = [];
    let raf = 0;
    let t = 0;

    function resize() {
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gap = 46;
      dots = [];
      for (let x = gap / 2; x < w; x += gap) {
        for (let y = gap / 2; y < h; y += gap) {
          dots.push({ x, y, phase: Math.random() * Math.PI * 2 });
        }
      }
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      t += reduce ? 0 : 0.015;
      for (const d of dots) {
        const s = (Math.sin(t + d.phase) + 1) / 2;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, 1 + s * 1.4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(193,131,47,${0.08 + s * 0.18})`;
        ctx!.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
