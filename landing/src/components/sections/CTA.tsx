"use client";
import { motion } from "framer-motion";

export function CTA() {
  return (
    <section id="cta" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(40,224,168,0.18),transparent_60%)]" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-display text-[42px] sm:text-[68px] font-medium leading-[1.0] tracking-tight"
        >
          Your books, ready<br /> before chai.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-5 text-[16.5px] text-white/65 max-w-xl mx-auto leading-relaxed"
        >
          Free for the first 100 bills a month. No card. No setup. Install the PWA, set up your shop in 4 minutes, and start billing.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <a href="#" className="btn-primary">
            Try free — start in 4 minutes
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <a href="#" className="btn-ghost">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Book a 15-min demo
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12.5px] text-white/45"
        >
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            No credit card
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            Hindi + English
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            Tally XML on day one
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            Works offline (PWA)
          </span>
        </motion.div>
      </div>
    </section>
  );
}
