"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { BillMockup } from "./mockups/BillMockup";
import { MagneticButton } from "./MagneticButton";

export function Hero() {
  const root = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const lines = el.querySelectorAll<HTMLElement>("[data-hero-line]");
      lines.forEach((line) => {
        const text = line.textContent ?? "";
        line.setAttribute("aria-label", text);
        line.textContent = "";
        const words = text.split(/(\s+)/);
        words.forEach((w) => {
          if (/^\s+$/.test(w)) {
            line.appendChild(document.createTextNode(w));
            return;
          }
          const wrap = document.createElement("span");
          wrap.className = "inline-block overflow-hidden align-bottom";
          const inner = document.createElement("span");
          inner.className = "inline-block translate-y-[110%] will-change-transform";
          inner.textContent = w;
          wrap.appendChild(inner);
          line.appendChild(wrap);
        });
      });

      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      tl.from("[data-hero-badge]", { y: 16, opacity: 0, duration: 0.7 })
        .to(
          el.querySelectorAll("[data-hero-line] span > span"),
          { y: 0, duration: 1.1, stagger: 0.035 },
          "-=0.4",
        )
        .from(
          "[data-hero-sub]",
          { y: 18, opacity: 0, filter: "blur(8px)", duration: 0.9 },
          "-=0.7",
        )
        .from(
          "[data-hero-cta] > *",
          { y: 18, opacity: 0, duration: 0.7, stagger: 0.08 },
          "-=0.6",
        )
        .from(
          "[data-hero-stat]",
          { y: 14, opacity: 0, duration: 0.6, stagger: 0.08 },
          "-=0.5",
        )
        .from(
          "[data-hero-mockup]",
          { y: 40, opacity: 0, scale: 0.96, duration: 1.1 },
          "-=1",
        )
        .from(
          "[data-hero-chip]",
          { y: 10, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.15 },
          "-=0.5",
        );

      if (pathRef.current) {
        const len = pathRef.current.getTotalLength();
        gsap.set(pathRef.current, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(pathRef.current, { strokeDashoffset: 0, duration: 1.1, ease: "power2.out" }, "-=1.2");
      }

      // Parallax mockup — apply to inner wrapper so it doesn't fight the entrance tween
      const parallax = el.querySelector<HTMLElement>("[data-hero-parallax]");
      if (parallax) {
        gsap.set(parallax, { transformPerspective: 1200, transformOrigin: "center" });
        const setRX = gsap.quickTo(parallax, "rotationY", { duration: 0.8, ease: "expo.out" });
        const setRY = gsap.quickTo(parallax, "rotationX", { duration: 0.8, ease: "expo.out" });
        const setX = gsap.quickTo(parallax, "x", { duration: 0.8, ease: "expo.out" });
        const setY = gsap.quickTo(parallax, "y", { duration: 0.8, ease: "expo.out" });
        const onMove = (ev: Event) => {
          const e = ev as unknown as { clientX: number; clientY: number };
          const r = el.getBoundingClientRect();
          const cx = (e.clientX - r.left) / r.width - 0.5;
          const cy = (e.clientY - r.top) / r.height - 0.5;
          setRX(cx * 6);
          setRY(-cy * 6);
          setX(cx * 8);
          setY(cy * 8);
        };
        el.addEventListener("mousemove", onMove);
        return () => el.removeEventListener("mousemove", onMove);
      }
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="top" className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="absolute inset-0 bg-noise opacity-[0.02]" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] bg-[radial-gradient(closest-side,rgba(37,99,235,0.08),transparent_70%)] blur-3xl glow-pulse" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
        <div>
          <div
            data-hero-badge
            className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/80 backdrop-blur px-3 py-1.5 text-[11.5px] text-slate-600"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] glow-pulse" />
            <span className="font-mono uppercase tracking-wider text-[10.5px] text-[#2563eb]">New</span>
            <span>Bank reconciliation · Tally Prime import is live</span>
          </div>

          <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[72px] leading-[0.96] font-medium mt-5 tracking-tight text-slate-900">
            <span data-hero-line className="block">Money In.</span>
            <span data-hero-line className="block">Money Out.</span>
            <span data-hero-line className="block text-slate-400">Your books take care</span>
            <span className="block">
              <span data-hero-line className="text-slate-400">of </span>
              <span className="relative inline-block">
                <span data-hero-line>themselves.</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none">
                  <path
                    ref={pathRef}
                    d="M2 9 C 70 1, 140 14, 298 5"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </span>
          </h1>

          <p data-hero-sub className="mt-7 text-[16px] sm:text-[17.5px] text-slate-500 max-w-[540px] leading-relaxed">
            SoloBooks is the bookkeeping app built for the Indian Dukandaar — fast billing, WhatsApp-native Udhar Khata, and Tally-ready handoff for your CA. <span className="text-slate-700">No &quot;debit&quot;. No &quot;credit&quot;. Just paisa.</span>
          </p>

          <div data-hero-cta className="mt-8 flex flex-wrap items-center gap-3">
            <MagneticButton href="/register" className="btn-primary">
              Try free — no card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </MagneticButton>
            <MagneticButton href="#tally" className="btn-ghost" strength={0.22}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
              See it in 90 seconds
            </MagneticButton>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 sm:gap-6 max-w-md">
            <Stat n="30s" label="Bill, start to share" />
            <Stat n="3 taps" label="To record paisa mila" />
            <Stat n="100%" label="Tally Prime ready" />
          </div>
        </div>

        <div data-hero-mockup className="relative lg:justify-self-end will-change-transform">
         <div data-hero-parallax className="relative will-change-transform">
          <div data-hero-chip className="absolute -top-6 -left-6 hidden lg:block">
            <FloatingChip>
              <span className="font-mono text-[10px] text-[#16a34a]">+ ₹17,030</span>
              <span className="text-slate-500 text-[11px]">paisa mila</span>
            </FloatingChip>
          </div>
          <div data-hero-chip className="absolute -bottom-2 -right-2 hidden lg:block">
            <FloatingChip>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
              <span className="text-slate-500 text-[11px]">Shared on WhatsApp</span>
            </FloatingChip>
          </div>
          <BillMockup />
         </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div data-hero-stat>
      <p className="font-display text-[28px] sm:text-[32px] font-semibold text-slate-900 leading-none">{n}</p>
      <p className="mt-1.5 text-[11.5px] text-slate-400 leading-snug">{label}</p>
    </div>
  );
}

function FloatingChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur ring-1 ring-slate-200/60 px-3 py-2 shadow-lg">
      {children}
    </div>
  );
}
