"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  href?: string;
  className?: string;
  strength?: number;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

export function MagneticButton({ href, className, children, strength = 0.35, onClick }: Props) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const setX = gsap.quickTo(el, "x", { duration: 0.5, ease: "expo.out" });
    const setY = gsap.quickTo(el, "y", { duration: 0.5, ease: "expo.out" });
    const setIX = gsap.quickTo(inner, "x", { duration: 0.55, ease: "expo.out" });
    const setIY = gsap.quickTo(inner, "y", { duration: 0.55, ease: "expo.out" });

    const onMove = (ev: Event) => {
      const e = ev as unknown as { clientX: number; clientY: number };
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      setX(x * strength);
      setY(y * strength);
      setIX(x * strength * 0.45);
      setIY(y * strength * 0.45);
    };
    const onLeave = () => {
      setX(0); setY(0); setIX(0); setIY(0);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  const inner = <span ref={innerRef} className="inline-flex items-center gap-2.5 will-change-transform">{children}</span>;

  if (href) {
    return (
      <a ref={ref as React.RefObject<HTMLAnchorElement>} href={href} className={className} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <button ref={ref as React.RefObject<HTMLButtonElement>} className={className} onClick={onClick}>
      {inner}
    </button>
  );
}
