import { useEffect, useRef } from "react";

/** A small constellation follows the pointer without intercepting page interaction. */
export function PointerAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let previous = 0;
    let active = false;
    let hovering = false;
    let opacity = 0;
    let x = 0, y = 0, targetX = 0, targetY = 0;
    let radius = 13;
    let width = innerWidth, height = innerHeight;
    const stars: { x: number; y: number; life: number }[] = [];
    const clicks: { x: number; y: number; age: number }[] = [];

    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      frame = 0;
      const dt = Math.min((now - previous) / 1000 || 0.016, 0.05);
      previous = now;
      const ease = 1 - Math.exp(-12 * dt);
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      radius += ((hovering ? 24 : 13) - radius) * ease;
      opacity += ((active ? 1 : 0) - opacity) * ease;
      context.clearRect(0, 0, width, height);

      if (opacity > 0.01) {
        const glow = context.createRadialGradient(x, y, 0, x, y, 125);
        glow.addColorStop(0, `rgba(197,168,131,${0.09 * opacity})`);
        glow.addColorStop(0.45, `rgba(101,181,185,${0.035 * opacity})`);
        glow.addColorStop(1, "rgba(101,181,185,0)");
        context.fillStyle = glow;
        context.fillRect(x - 125, y - 125, 250, 250);
        context.strokeStyle = `rgba(197,168,131,${0.55 * opacity})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.stroke();
        // The exact pointer tip stays under the mouse; only the outer halo trails.
        context.fillStyle = `rgba(232,213,183,${opacity})`;
        context.beginPath(); context.arc(targetX,targetY,2.5,0,Math.PI*2); context.fill();
        context.strokeStyle = `rgba(232,213,183,${opacity*.8})`;
        context.beginPath(); context.ellipse(targetX,targetY,7,3,Math.PI/4,0,Math.PI*2); context.stroke();
        context.beginPath(); context.ellipse(targetX,targetY,7,3,-Math.PI/4,0,Math.PI*2); context.stroke();
      }
      for (let i=clicks.length-1;i>=0;i--) {
        const click=clicks[i]; click.age+=dt;
        const progress=click.age/.55;
        if (progress>=1) { clicks.splice(i,1);continue; }
        context.strokeStyle=`rgba(232,213,183,${(1-progress)*.65})`;
        context.lineWidth=1.2;
        context.beginPath();context.arc(click.x,click.y,8+progress*35,0,Math.PI*2);context.stroke();
        for(let ray=0;ray<6;ray++) {
          const angle=ray*Math.PI/3,inner=8+progress*18,outer=inner+5*(1-progress);
          context.beginPath();context.moveTo(click.x+Math.cos(angle)*inner,click.y+Math.sin(angle)*inner);
          context.lineTo(click.x+Math.cos(angle)*outer,click.y+Math.sin(angle)*outer);context.stroke();
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.life -= dt * 1.5;
        if (star.life <= 0) { stars.splice(i, 1); continue; }
        context.fillStyle = `rgba(197,168,131,${star.life * 0.5})`;
        context.beginPath();
        context.arc(star.x, star.y, 1.4 * star.life, 0, Math.PI * 2);
        context.fill();
        const next = stars[i - 1];
        if (next && Math.hypot(next.x - star.x, next.y - star.y) < 70) {
          context.strokeStyle = `rgba(101,181,185,${star.life * 0.2})`;
          context.beginPath();
          context.moveTo(star.x, star.y);
          context.lineTo(next.x, next.y);
          context.stroke();
        }
      }
      const settling = active
        ? Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs((hovering ? 24 : 13) - radius) > 0.1 || opacity < 0.99
        : opacity > 0.01;
      if (settling || stars.length || clicks.length) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(draw); }
    };
    const leave = () => { active = false;delete document.documentElement.dataset.labCursor;wake(); };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("input,textarea,select,[contenteditable=true],.hero-preview")) { leave(); return; }
      if (!active) { x = event.clientX; y = event.clientY; }
      targetX = event.clientX;
      targetY = event.clientY;
      active = true;
      document.documentElement.dataset.labCursor="on";
      hovering = !!element?.closest("a,button,[role=button],[data-cursor-hover]");
      const last = stars.at(-1);
      if (!last || Math.hypot(last.x - targetX, last.y - targetY) > 14) {
        stars.push({ x: targetX, y: targetY, life: 1 });
        if (stars.length > 24) stars.shift();
      }
      wake();
    };
    const click = (event: PointerEvent) => {
      if (!media.matches || event.pointerType!=="mouse" || event.button!==0) return;
      const element=event.target instanceof Element ? event.target : null;
      if (element?.closest("input,textarea,select,[contenteditable=true],.hero-preview")) return;
      clicks.push({x:event.clientX,y:event.clientY,age:0});
      if(clicks.length>6)clicks.shift();
      wake();
    };
    const reset = () => {
      active = false;
      opacity = 0;
      stars.length = 0;
      clicks.length = 0;
      delete document.documentElement.dataset.labCursor;
      cancelAnimationFrame(frame);
      frame = 0;
      context.clearRect(0, 0, width, height);
    };
    const visibility = () => { if (document.hidden) reset(); };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", click, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", click);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", reset);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-atmosphere" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2147483000 }} />;
}
