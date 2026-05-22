"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Direct-child stagger reveal. Set false to animate the wrapper itself. */
  stagger?: boolean;
  y?: number;
  duration?: number;
  delay?: number;
  start?: string;
  as?: "div" | "section";
  id?: string;
};

export function Reveal({
  children,
  className,
  stagger = true,
  y = 28,
  duration = 1,
  delay = 0,
  start = "top 82%",
  as = "div",
  id,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const targets: Element[] | NodeListOf<Element> = stagger
        ? Array.from(el.children)
        : [el];
      if (!targets || (targets as Element[]).length === 0) return;

      gsap.set(targets, { opacity: 0, y, filter: "blur(6px)" });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration,
        delay,
        stagger: stagger ? 0.09 : 0,
        ease: "expo.out",
        scrollTrigger: {
          trigger: el,
          start,
          toggleActions: "play none none none",
        },
      });
    }, ref);

    return () => ctx.revert();
  }, [stagger, y, duration, delay, start]);

  const Comp = as;
  return (
    <Comp ref={ref as never} id={id} className={className}>
      {children}
    </Comp>
  );
}
