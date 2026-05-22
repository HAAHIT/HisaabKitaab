"use client";
import { motion } from "framer-motion";
import { BillMockup } from "./mockups/BillMockup";

export function Hero() {
  return (
    <section id="top" className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="absolute inset-0 bg-noise opacity-[0.04]" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] bg-[radial-gradient(closest-side,rgba(40,224,168,0.16),transparent_70%)] blur-3xl glow-pulse" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-1.5 text-[11.5px] text-white/75"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#28e0a8] glow-pulse" />
            <span className="font-mono uppercase tracking-wider text-[10.5px] text-[#4fe9b9]">New</span>
            <span>Bank reconciliation · Tally Prime import is live</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-[44px] sm:text-[60px] lg:text-[72px] leading-[0.96] font-medium mt-5 tracking-tight"
          >
            Money In.<br />
            Money Out.<br />
            <span className="text-white/55">Your books take care</span><br />
            <span className="text-white/55">of </span>
            <span className="relative inline-block">
              themselves.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none">
                <motion.path
                  d="M2 9 C 70 1, 140 14, 298 5"
                  stroke="#28e0a8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, delay: 0.8, ease: "easeOut" }}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-7 text-[16px] sm:text-[17.5px] text-white/65 max-w-[540px] leading-relaxed"
          >
            SoloBooks is the bookkeeping app built for the Indian Dukandaar — fast billing, WhatsApp-native Udhar Khata, and Tally-ready handoff for your CA. <span className="text-white/85">No "debit". No "credit". Just paisa.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a href="#cta" className="btn-primary">
              Try free — no card
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <a href="#tally" className="btn-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
              See it in 90 seconds
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 grid grid-cols-3 gap-4 sm:gap-6 max-w-md"
          >
            <Stat n="30s" label="Bill, start to share" />
            <Stat n="3 taps" label="To record paisa mila" />
            <Stat n="100%" label="Tally Prime ready" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="relative lg:justify-self-end"
        >
          <div className="absolute -top-6 -left-6 hidden lg:block">
            <FloatingChip>
              <span className="font-mono text-[10px] text-[#28e0a8]">+ ₹17,030</span>
              <span className="text-white/60 text-[11px]">paisa mila</span>
            </FloatingChip>
          </div>
          <div className="absolute -bottom-2 -right-2 hidden lg:block">
            <FloatingChip delay={0.6}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4fe9b9" strokeWidth="3" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
              <span className="text-white/70 text-[11px]">Shared on WhatsApp</span>
            </FloatingChip>
          </div>
          <BillMockup />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[28px] sm:text-[32px] font-semibold text-white leading-none">{n}</p>
      <p className="mt-1.5 text-[11.5px] text-white/50 leading-snug">{label}</p>
    </div>
  );
}

function FloatingChip({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.8 + delay }}
      className="flex items-center gap-2 rounded-full bg-[#0f1316]/90 backdrop-blur ring-1 ring-white/10 px-3 py-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
    >
      {children}
    </motion.div>
  );
}
