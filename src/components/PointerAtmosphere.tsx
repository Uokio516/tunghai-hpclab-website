import { useEffect, useRef } from "react";

type Spark = { angle: number; reach: number; size: number; color: number };
type Burst = { x: number; y: number; started: number; power: number; combo: number; sparks: Spark[] };
const TAU = Math.PI * 2;
const NATIVE_CURSOR = "input,textarea,select,[contenteditable]:not([contenteditable=false]),.hero-preview";

/** Bounded star particles; the canvas stops drawing when the pointer rests. */
export function PointerAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const root = document.documentElement;
    let width = innerWidth, height = innerHeight, frame = 0, previous = 0;
    let active = false, hovering = false, opacity = 0, radius = 13;
    let x = 0, y = 0, haloX = 0, haloY = 0, combo = 0, lastRelease = -Infinity;
    let light = root.dataset.theme === "light";
    let charge: { started: number; pointerId: number } | null = null;
    const trail: { x: number; y: number; started: number }[] = [];
    const bursts: Burst[] = [];
    const dot = (px: number, py: number, size: number, color: string, alpha: number) => {
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.beginPath(); ctx.arc(px, py, size, 0, TAU); ctx.fill();
    };
    const glow = (px: number, py: number, size: number, color: string, alpha: number) => {
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, size);
      gradient.addColorStop(0, `rgba(${color},${alpha})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = gradient; ctx.fillRect(px - size, py - size, size * 2, size * 2);
    };
    const draw = (now: number) => {
      frame = 0;
      const dt = Math.min((now - previous) / 1000 || .016, .05);
      previous = now;
      const ease = 1 - Math.exp(-12 * dt);
      haloX += (x - haloX) * ease; haloY += (y - haloY) * ease;
      radius += ((hovering ? 24 : 13) - radius) * ease;
      opacity += ((active ? 1 : 0) - opacity) * ease;
      const colors = light ? ["133,91,43", "24,122,139", "127,83,150"] : ["241,213,166", "111,211,225", "201,159,242"];
      ctx.clearRect(0, 0, width, height);
      while (trail.length && now - trail[0].started > 360) trail.shift();
      trail.forEach((point, i) => {
        const life = 1 - (now - point.started) / 360;
        const next = trail[i + 1];
        if (next && Math.hypot(next.x - point.x, next.y - point.y) < 90) {
          ctx.strokeStyle = `rgba(${colors[0]},${life * .28})`; ctx.lineWidth = life * 2;
          ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(next.x, next.y); ctx.stroke();
        }
        if (i % 3 === 0) dot(point.x + Math.sin(i * 2.4) * 5, point.y + Math.cos(i * 1.8) * 5, .6 + life, colors[i % 3], life * .7);
      });
      if (charge) {
        const age = now - charge.started, power = Math.min(age / 1200, 1);
        glow(x, y, 36 + power * 62, colors[1], .12 + power * .16);
        glow(x, y, 10 + power * 18, colors[0], .28 + power * .25);
        for (let i = 0; i < 28; i++) {
          const phase = (age / 850 + i / 28) % 1;
          const distance = 7 + (1 - phase) ** 1.5 * (32 + power * 55);
          const angle = i * 2.39996 + age * .0018 + phase * 1.8;
          dot(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, .7 + phase * 1.2, colors[i % 3], Math.sin(phase * Math.PI) * (.45 + power * .5));
        }
        ctx.strokeStyle = `rgba(${colors[0]},${.35 + power * .45})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(x, y, 22 + power * 5, -Math.PI / 2, -Math.PI / 2 + TAU * power); ctx.stroke();
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const burst = bursts[i], progress = (now - burst.started) / (620 + burst.power * 430);
        if (progress >= 1) { bursts.splice(i, 1); continue; }
        const travel = 1 - (1 - progress) ** 3, alpha = (1 - progress) ** 1.5;
        const accent = colors[burst.combo >= 5 ? 2 : burst.combo >= 3 ? 1 : 0];
        glow(burst.x, burst.y, 22 + travel * 65, accent, alpha * (.12 + burst.power * .14));
        // A shockwave is reserved for charged releases; clicks produce star streaks.
        if (burst.power > .3) {
          ctx.strokeStyle = `rgba(${accent},${alpha * .45})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(burst.x, burst.y, 8 + travel * (48 + burst.power * 75), 0, TAU); ctx.stroke();
        }
        burst.sparks.forEach(spark => {
          const distance = 4 + spark.reach * travel;
          const px = burst.x + Math.cos(spark.angle) * distance, py = burst.y + Math.sin(spark.angle) * distance;
          const tail = (3 + burst.power * 13) * (1 - progress);
          ctx.strokeStyle = `rgba(${colors[spark.color]},${alpha * .8})`; ctx.lineWidth = spark.size * .7;
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(spark.angle) * tail, py - Math.sin(spark.angle) * tail); ctx.stroke();
          dot(px, py, spark.size * (1 - progress * .6), colors[spark.color], alpha);
        });
      }
      const latest = bursts.at(-1);
      if (latest && latest.combo > 1) {
        const age = now - latest.started, alpha = Math.min(age / 70, 1) * Math.max(0, 1 - age / 700);
        const bx = Math.max(42, Math.min(width - 42, latest.x));
        const by = latest.y < 70 ? latest.y + 42 : latest.y - 35;
        ctx.fillStyle = light ? `rgba(245,240,230,${alpha * .95})` : `rgba(18,21,26,${alpha * .9})`;
        ctx.beginPath(); ctx.roundRect(bx - 37, by - 12, 74, 24, 12); ctx.fill();
        ctx.fillStyle = `rgba(${colors[latest.combo >= 5 ? 2 : 0]},${alpha})`;
        ctx.font = "600 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`COMBO ×${latest.combo}`, bx, by);
      }
      if (opacity > .01) {
        const ringColor = light ? colors[0] : "197,168,131";
        const halo = ctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, 125);
        halo.addColorStop(0, `rgba(${ringColor},${.09 * opacity})`);
        halo.addColorStop(.45, `rgba(${colors[1]},${.035 * opacity})`);
        halo.addColorStop(1, `rgba(${colors[1]},0)`);
        ctx.fillStyle = halo; ctx.fillRect(haloX - 125, haloY - 125, 250, 250);
        ctx.strokeStyle = `rgba(${ringColor},${.55 * opacity})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(haloX, haloY, radius, 0, TAU); ctx.stroke();
      }
      const settling = Math.abs(x - haloX) + Math.abs(y - haloY) + Math.abs((hovering ? 24 : 13) - radius) > .1;
      if (charge || bursts.length || trail.length || (active ? settling || opacity < .99 : opacity > .01)) frame = requestAnimationFrame(draw);
    };
    const wake = () => { if (!frame) { previous = performance.now(); frame = requestAnimationFrame(draw); } };
    const reset = () => {
      active = false; opacity = 0; charge = null; combo = 0; lastRelease = -Infinity;
      trail.length = 0; bursts.length = 0;
      cancelAnimationFrame(frame); frame = 0; ctx.clearRect(0, 0, width, height);
    };
    const resize = () => {
      width = innerWidth; height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * ratio; canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); if (active) wake();
    };
    const nativeTarget = (event: PointerEvent) => event.target instanceof Element && !!event.target.closest(NATIVE_CURSOR);
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      if (nativeTarget(event)) { reset(); return; }
      if (!active) { haloX = event.clientX; haloY = event.clientY; }
      x = event.clientX; y = event.clientY; active = true;
      hovering = event.target instanceof Element && !!event.target.closest("a,button,[role=button],[data-cursor-hover]");
      const last = trail.at(-1);
      if (!last || Math.hypot(last.x - x, last.y - y) > 5) {
        trail.push({ x, y, started: performance.now() }); if (trail.length > 32) trail.shift();
      }
      wake();
    };
    const press = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse" || event.button !== 0 || nativeTarget(event)) return;
      move(event); charge = { started: performance.now(), pointerId: event.pointerId }; wake();
    };
    const release = (event: PointerEvent) => {
      if (!charge || event.pointerId !== charge.pointerId || event.button !== 0) return;
      if (!media.matches || nativeTarget(event)) { reset(); return; }
      const now = performance.now();
      combo = now - lastRelease <= 900 ? Math.min(combo + 1, 8) : 1; lastRelease = now;
      const power = Math.min((now - charge.started) / 1200, 1), count = 12 + Math.round(power * 28) + (combo - 1) * 3;
      bursts.push({ x: event.clientX, y: event.clientY, started: now, power, combo,
        sparks: Array.from({ length: count }, (_, i) => ({
          angle: i * TAU / count + Math.random() * .15,
          reach: (26 + power * 125 + (combo - 1) * 9) * (.4 + Math.random() * .6),
          size: .8 + Math.random() * 1.2, color: i % 3,
        })),
      });
      if (bursts.length > 4) bursts.shift();
      charge = null; wake();
    };
    const cancel = (event: PointerEvent) => { if (charge?.pointerId === event.pointerId) reset(); };
    const visibility = () => { if (document.hidden) reset(); };
    const themeObserver = new MutationObserver(() => { light = root.dataset.theme === "light"; if (active) wake(); });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    root.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", reset);
    return () => {
      reset(); themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      root.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", reset);
    };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-atmosphere" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2147483000 }} />;
}
