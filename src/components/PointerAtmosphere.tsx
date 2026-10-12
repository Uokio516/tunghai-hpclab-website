import { useEffect, useRef } from "react";

/** A constellation follows the mouse and charges into a small galaxy on hold. */
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
    let charge: { x: number; y: number; started: number; pointerId: number } | null = null;
    const bursts: { x: number; y: number; age: number; power: number; angles: number[] }[] = [];

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

      if (charge) {
        const power = Math.min((now - charge.started) / 1200, 1);
        const cx = charge.x, cy = charge.y;
        const halo = context.createRadialGradient(cx, cy, 0, cx, cy, 72 + power * 65);
        halo.addColorStop(0, `rgba(243,219,178,${0.26 + power * 0.23})`);
        halo.addColorStop(0.23, `rgba(150,112,205,${0.12 + power * 0.13})`);
        halo.addColorStop(1, "rgba(78,165,210,0)");
        context.fillStyle = halo;
        context.beginPath();context.arc(cx,cy,72+power*65,0,Math.PI*2);context.fill();
        for (let orbit = 0; orbit < 3; orbit++) {
          const orbitRadius = 18 + orbit * 8 + power * (16 + orbit * 5);
          const rotation = now * (orbit % 2 ? -0.0021 : 0.0027) + orbit * 2.1;
          context.strokeStyle = orbit === 1 ? `rgba(115,190,220,${0.28 + power * 0.2})` : `rgba(232,213,183,${0.25 + power * 0.25})`;
          context.lineWidth = 1;
          context.beginPath();context.ellipse(cx,cy,orbitRadius,orbitRadius * 0.46,rotation,0,Math.PI*2);context.stroke();
          const starX = cx + Math.cos(rotation) * orbitRadius;
          const starY = cy + Math.sin(rotation) * orbitRadius * 0.46;
          context.fillStyle = orbit === 1 ? "#8ed8e7" : "#f2d9aa";
          context.beginPath();context.arc(starX,starY,1.5+power*1.2,0,Math.PI*2);context.fill();
        }
        context.strokeStyle = `rgba(242,217,170,${0.5 + power * 0.4})`;
        context.lineWidth = 1.4;
        context.beginPath();context.arc(cx,cy,13 + power * 28,-Math.PI/2,-Math.PI/2 + Math.PI*2*power);context.stroke();
      }
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
      for (let i=bursts.length-1;i>=0;i--) {
        const burst=bursts[i];burst.age+=dt;
        const progress=burst.age/(0.55+burst.power*0.48);
        if (progress>=1) { bursts.splice(i,1);continue; }
        const travel=1-Math.pow(1-progress,2.4);
        const spread=38+burst.power*105;
        const alpha=(1-progress)*(0.55+burst.power*0.42);
        const flash=context.createRadialGradient(burst.x,burst.y,0,burst.x,burst.y,32+spread*travel);
        flash.addColorStop(0,`rgba(248,229,188,${alpha*0.32})`);
        flash.addColorStop(0.45,`rgba(136,112,211,${alpha*0.13})`);
        flash.addColorStop(1,"rgba(136,112,211,0)");
        context.fillStyle=flash;context.beginPath();context.arc(burst.x,burst.y,32+spread*travel,0,Math.PI*2);context.fill();
        for(let ring=0;ring<2;ring++) {
          context.strokeStyle=ring ? `rgba(106,195,214,${alpha*0.62})` : `rgba(242,217,170,${alpha})`;
          context.lineWidth=ring ? 1 : 1.7;
          context.beginPath();context.arc(burst.x,burst.y,9+spread*travel*(ring ? 0.68 : 1),0,Math.PI*2);context.stroke();
        }
        burst.angles.forEach((angle,index)=>{
          const distance=(19+(index%5)*4+spread*(0.5+(index%7)/13)*travel);
          const wobble=Math.sin(index*2.7+progress*7)*5*progress;
          const px=burst.x+Math.cos(angle)*distance-Math.sin(angle)*wobble;
          const py=burst.y+Math.sin(angle)*distance+Math.cos(angle)*wobble;
          context.fillStyle=index%3===0?`rgba(105,208,226,${alpha})`:index%3===1?`rgba(236,175,204,${alpha})`:`rgba(249,222,165,${alpha})`;
          context.beginPath();context.arc(px,py,(index%4===0?2.5:1.4)*(1-progress*0.55),0,Math.PI*2);context.fill();
        });
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
      if (settling || stars.length || bursts.length || charge) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(draw); }
    };
    const leave = () => { active = false;charge = null;delete document.documentElement.dataset.labCursor;wake(); };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("input,textarea,select,[contenteditable=true],.hero-preview")) { leave(); return; }
      if (!active) { x = event.clientX; y = event.clientY; }
      targetX = event.clientX;
      targetY = event.clientY;
      if (charge?.pointerId === event.pointerId) { charge.x = targetX; charge.y = targetY; }
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
    const press = (event: PointerEvent) => {
      if (!media.matches || event.pointerType!=="mouse" || event.button!==0) return;
      const element=event.target instanceof Element ? event.target : null;
      if (element?.closest("input,textarea,select,[contenteditable=true],.hero-preview")) return;
      targetX=event.clientX;targetY=event.clientY;
      charge={x:targetX,y:targetY,started:performance.now(),pointerId:event.pointerId};
      wake();
    };
    const release = (event: PointerEvent) => {
      if (!charge || event.pointerId !== charge.pointerId || event.pointerType !== "mouse") return;
      const power=Math.min((performance.now()-charge.started)/1200,1);
      const count=12+Math.round(power*32);
      bursts.push({x:event.clientX,y:event.clientY,age:0,power,angles:Array.from({length:count},(_,i)=>i*Math.PI*2/count+(i%3)*0.05)});
      if (bursts.length>4) bursts.shift();
      charge=null;
      wake();
    };
    const cancel = (event: PointerEvent) => { if (charge?.pointerId===event.pointerId) { charge=null;wake(); } };
    const reset = () => {
      active = false;
      opacity = 0;
      stars.length = 0;
      charge = null;
      bursts.length = 0;
      delete document.documentElement.dataset.labCursor;
      cancelAnimationFrame(frame);
      frame = 0;
      context.clearRect(0, 0, width, height);
    };
    const visibility = () => { if (document.hidden) reset(); };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", reset);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-atmosphere" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2147483000 }} />;
}
