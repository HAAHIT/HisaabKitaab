"use client";
import { motion } from "framer-motion";
import { TallyMockup } from "../mockups/TallyMockup";

export function TallySection() {
  return (
    <section id="tally" className="relative py-24 sm:py-32 overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#28e0a8]/40 to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="divider-tick">03 — Tally I/O</span>
          <h2 className="font-display text-[36px] sm:text-[56px] font-medium leading-[1.02] tracking-tight mt-4">
            One tap. <span className="text-white/55">Your CA's inbox.</span>
          </h2>
          <p className="mt-5 text-[16.5px] text-white/65 leading-relaxed">
            Every "paisa mila" silently writes a balanced double-entry voucher in the background. At quarter-end, hit <span className="text-white/85">Export</span> and SoloBooks hands your Chartered Accountant a Tally XML that imports without errors — every time. Round-trip Tally Prime support means CA edits flow back in too.
          </p>
        </motion.div>

        <div className="mt-14">
          <TallyMockup />
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          <Pillar
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11V7a3 3 0 0 1 6 0v4"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>
            }
            title="Trust-gated exports"
            body="Unbalanced or pending vouchers block the export. Your CA never gets a broken file."
          />
          <Pillar
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M17 17H7M17 17V7"/></svg>
            }
            title="Tally Prime + ERP 9"
            body="GUID-stamped vouchers. Idempotent imports. CGST/SGST split by state code, automatically."
          />
          <Pillar
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            }
            title="FY-aware"
            body="Apr–Mar by default. Quarterly handoff packages auto-bundle everything since the last export."
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="card p-5 sm:p-6"
    >
      <div className="h-9 w-9 rounded-lg bg-[#28e0a8]/12 ring-1 ring-[#28e0a8]/25 text-[#4fe9b9] grid place-items-center">
        {icon}
      </div>
      <h3 className="mt-4 text-[16px] font-medium text-white">{title}</h3>
      <p className="mt-1.5 text-[13px] text-white/55 leading-relaxed">{body}</p>
    </motion.div>
  );
}
