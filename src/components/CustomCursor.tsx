import { useEffect, useRef, useState } from "react";

/* A small dot + trailing ring that follows the pointer, enlarging over
   interactive elements. Scoped to whatever container renders it — the
   caller hides the native cursor (via a `cursor-none` class) so this
   never appears twice. Touch devices get nothing (no pointer to track). */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (isTouch) return;
    let ringX = 0, ringY = 0, targetX = 0, targetY = 0;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${targetX}px, ${targetY}px)`;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      setHovering(!!el?.closest("a, button, [data-cursor-hover]"));
    };
    window.addEventListener("pointermove", onMove);

    const animateRing = () => {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = requestAnimationFrame(animateRing);
    };
    raf = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [isTouch]);

  if (isTouch) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[200] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--brand-light)" }}
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[200] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-[width,height] duration-200"
        style={{
          width: hovering ? 52 : 32,
          height: hovering ? 52 : 32,
          borderColor: "var(--brand-light)",
          borderWidth: 1,
          opacity: 0.7,
        }}
      />
    </>
  );
}
