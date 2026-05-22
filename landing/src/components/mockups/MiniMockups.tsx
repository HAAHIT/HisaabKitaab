"use client";
import { motion } from "framer-motion";

export function BankReconcileMockup() {
  const rows = [
    { name: "Sunita Textiles", amt: 24800, match: true },
    { name: "UPI/Q198822", amt: 7200, match: true },
    { name: "Cash deposit", amt: 18000, match: false },
    { name: "Mohan Wholesale", amt: 12450, match: true },
  ];
  return (
    <div className="card shine p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40">HDFC ••• 2241</p>
          <p className="text-[15px] font-semibold text-white mt-0.5">May statement</p>
        </div>
        <span className="text-[10px] font-mono rounded-full px-2 py-1 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20">
          12 / 14 matched
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`h-1.5 w-1.5 rounded-full ${r.match ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="text-[12px] text-white/85 truncate">{r.name}</span>
            </div>
            <span className="font-mono text-[11.5px] text-white/70">₹{r.amt.toLocaleString("en-IN")}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10.5px] text-white/40">2 lines waiting · tap to assign</span>
        <span className="text-[11px] text-[#28e0a8] font-medium">Resolve →</span>
      </div>
    </div>
  );
}

export function PurchaseOcrMockup() {
  return (
    <div className="card shine p-5 h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#28e0a8]">AI · OCR</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span className="text-[10px] text-white/40">Gemini Flash</span>
      </div>
      <div className="grid grid-cols-[88px_1fr] gap-3 items-start">
        <div className="aspect-[3/4] rounded-lg ring-1 ring-white/10 bg-[linear-gradient(135deg,#1a1f24,#0c1014)] relative overflow-hidden">
          <div className="absolute inset-x-2 top-2 h-1 rounded bg-white/15" />
          <div className="absolute inset-x-2 top-4 h-1 rounded bg-white/10" />
          <div className="absolute inset-x-2 top-6 h-1 rounded bg-white/10" />
          <div className="absolute left-2 right-6 bottom-12 h-1 rounded bg-white/10" />
          <div className="absolute left-2 right-10 bottom-10 h-1 rounded bg-white/10" />
          <motion.div
            animate={{ y: [0, 110, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-0 h-[2px] bg-[#28e0a8]/70 shadow-[0_0_20px_#28e0a8]"
          />
          <span className="absolute bottom-1 left-2 font-mono text-[8px] text-white/50">supplier_bill.jpg</span>
        </div>
        <div className="text-[11.5px] space-y-1.5">
          <Field label="Vendor" value="Sharma Trading Co." />
          <Field label="Bill No." value="ST/24/1882" mono />
          <Field label="Date" value="14 May 2026" />
          <Field label="GSTIN" value="07AABCS1234M1ZK" mono />
          <Field label="Total" value="₹38,420" highlight />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10.5px] text-white/40">5 fields extracted · 1.2s</span>
        <button className="text-[11px] text-[#28e0a8] font-medium">Save bill →</button>
      </div>
    </div>
  );
}

function Field({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5">
      <span className="text-white/40 text-[10.5px] uppercase tracking-wider">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-[#4fe9b9] font-semibold" : "text-white/85"}`}>{value}</span>
    </div>
  );
}

export function GstMockup() {
  const cards = [
    { label: "Output GST", value: "₹84,212", tone: "amber" },
    { label: "Input credit", value: "₹52,108", tone: "jade" },
    { label: "Net payable", value: "₹32,104", tone: "rose" },
  ];
  return (
    <div className="card shine p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40">GSTR-3B preview</p>
          <p className="text-[15px] font-semibold text-white mt-0.5">May 2026</p>
        </div>
        <span className="text-[10px] font-mono rounded-full px-2 py-1 bg-white/5 text-white/70 ring-1 ring-white/10">Ready</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-3">
            <p className="text-[9px] uppercase tracking-wider text-white/40">{c.label}</p>
            <p className={`mt-1 text-[14px] font-semibold ${
              c.tone === "amber" ? "text-amber-300" : c.tone === "jade" ? "text-emerald-300" : "text-rose-300"
            }`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#28e0a8]/[0.05] ring-1 ring-[#28e0a8]/15 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
          <span className="text-[11.5px] text-white/85">All vouchers balanced · 0 unposted</span>
        </div>
        <span className="text-[11px] text-[#28e0a8] font-medium">Download →</span>
      </div>
    </div>
  );
}
