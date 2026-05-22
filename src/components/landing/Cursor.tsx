"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function Cursor() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 1, x: -100, y: -100 });

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "expo.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "expo.out" });

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    const onEnter = () => gsap.to(el, { opacity: 1, duration: 0.2 });
    const onLeave = () => gsap.to(el, { opacity: 0, duration: 0.2 });

    const setHover = (active: boolean) => {
      gsap.to(el, {
        scale: active ? 1.7 : 1,
        backgroundColor: active ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0)",
        borderColor: active ? "rgba(37,99,235,0.85)" : "rgba(15,23,42,0.35)",
        duration: 0.4,
        ease: "expo.out",
      });
    };

    const isInteractive = (t: EventTarget | null) => {
      const n = t as HTMLElement | null;
      return !!(n && n.closest("a, button, [role='button'], [data-cursor='hover']"));
    };
    const onOver = (e: MouseEvent) => { if (isInteractive(e.target)) setHover(true); };
    const onOut  = (e: MouseEvent) => { if (isInteractive(e.target) && !isInteractive(e.relatedTarget)) setHover(false); };

    const onDown = () => gsap.to(el, { scale: 0.85, duration: 0.15, ease: "power2.out" });
    const onUp   = () => gsap.to(el, { scale: 1, duration: 0.3, ease: "expo.out" });

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseenter", onEnter);
    window.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[100] hidden md:block rounded-full"
      style={{
        width: 32,
        height: 32,
        border: "2px solid #2563eb",
        backgroundColor: "rgba(37,99,235,0.08)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px -8px rgba(37,99,235,0.45)",
      }}
    />
  );
}
