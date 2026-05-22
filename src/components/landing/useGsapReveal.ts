"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Options = {
  selector?: string;
  y?: number;
  stagger?: number;
  duration?: number;
  delay?: number;
  start?: string;
  once?: boolean;
};

export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(opts: Options = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const {
      selector = "[data-reveal]",
      y = 28,
      stagger = 0.08,
      duration = 0.95,
      delay = 0,
      start = "top 85%",
      once = true,
    } = opts;

    const targets = el.querySelectorAll<HTMLElement>(selector);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y, filter: "blur(6px)" });

    const tween = gsap.to(targets, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration,
      delay,
      stagger,
      ease: "expo.out",
      scrollTrigger: {
        trigger: el,
        start,
        toggleActions: once ? "play none none none" : "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [opts]);

  return ref;
}
