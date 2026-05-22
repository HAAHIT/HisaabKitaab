"use client";
import { motion } from "framer-motion";

const lines = [
  { acc: "Sundry Debtors — Ramesh", dr: 17030, cr: 0 },
  { acc: "Sales A/c", dr: 0, cr: 16219 },
  { acc: "CGST Output 2.5%", dr: 0, cr: 405 },
  { acc: "SGST Output 2.5%", dr: 0, cr: 405 },
];

export function TallyMockup() {
  return (
    <div className="relative w-full max-w-[640px] mx-auto">
      <div className="absolute -inset-16 bg-[radial-gradient(closest-side,rgba(40,224,168,0.18),transparent_70%)] blur-3xl" aria-hidden />
      <div className="relative grid sm:grid-cols-[1.05fr_auto_1fr] items-center gap-3 sm:gap-5">
        {/* Source: SoloBooks bill */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="card shine p-4 sm:p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider text-[#28e0a8]">SoloBooks</span>
            <span className="font-mono text-[10px] text-white/40">BILL-202605-018</span>
          </div>
          <p className="text-[11px] text-white/50">Bill to Ramesh General Store</p>
          <p className="font-display text-[28px] font-semibold mt-1 text-white">₹17,030</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
              <p className="text-white/40">Subtotal</p>
              <p className="font-mono">₹16,219</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
              <p className="text-white/40">GST 5%</p>
              <p className="font-mono">₹811</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-white/40">User sees: <span className="text-white/70">"₹17,030 mila"</span></p>
        </motion.div>

        {/* Arrow / pipeline */}
        <div className="hidden sm:flex flex-col items-center text-white/40">
          <motion.div
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </motion.div>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#28e0a8]/80">XML</span>
        </div>
        <div className="sm:hidden flex justify-center text-[#28e0a8]/80 my-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
        </div>

        {/* Destination: Tally voucher */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-[#0a0d10] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400/70" />
              <span className="h-2 w-2 rounded-full bg-amber-400/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            </div>
            <span className="font-mono text-[9.5px] text-white/40">Tally Prime — Sales Voucher</span>
          </div>
          <div className="p-3.5 font-mono text-[11px]">
            <div className="grid grid-cols-[1fr_auto_auto] text-white/40 text-[9.5px] uppercase tracking-wider pb-2">
              <span>Particulars</span><span className="text-right">Dr</span><span className="text-right pl-3">Cr</span>
            </div>
            {lines.map((l) => (
              <div key={l.acc} className="grid grid-cols-[1fr_auto_auto] py-1 border-t border-white/5">
                <span className="text-white/80">{l.acc}</span>
                <span className="text-right text-[#4fe9b9]">{l.dr ? l.dr.toLocaleString("en-IN") : "—"}</span>
                <span className="text-right pl-3 text-[#e7ad79]">{l.cr ? l.cr.toLocaleString("en-IN") : "—"}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_auto] py-1.5 mt-1 border-t border-white/15 font-semibold">
              <span>Total</span>
              <span className="text-right text-[#4fe9b9]">17,030</span>
              <span className="text-right pl-3 text-[#e7ad79]">17,030</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[#28e0a8] text-[10px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
              <span>Balanced · Ready to import</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
