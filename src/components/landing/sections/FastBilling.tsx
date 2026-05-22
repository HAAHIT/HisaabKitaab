"use client";
import { motion } from "framer-motion";

export function FastBilling() {
  const steps = [
    { n: "01", title: "Party chuno", body: "Search by name or number. Recent parties auto-suggest. Naya party? 1 tap to add." },
    { n: "02", title: "Items daalo", body: "Live formula engine. GST splits CGST/SGST or IGST automatically by state." },
    { n: "03", title: "Pakka karo", body: "Tap once. Bill is finalized, journal is posted, and the WhatsApp share sheet opens with UPI link inside." },
  ];

  return (
    <section id="fast-billing" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute -top-40 left-0 w-[500px] h-[500px] bg-[radial-gradient(closest-side,rgba(37,99,235,0.06),transparent_70%)] blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
        <div className="order-2 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="divider-tick">01 — Fast Billing</span>
            <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4 text-slate-900">
              A bill, ready to send.<br />
              <span className="text-slate-400">In the time it takes to pour chai.</span>
            </h2>
            <p className="mt-5 text-[16px] text-slate-500 max-w-[520px] leading-relaxed">
              Repeat customer? 3 taps. New customer? 30 seconds. The GST is right. The journal is balanced. The WhatsApp link is ready — with a UPI button inside the message so they can pay before they reply.
            </p>
          </motion.div>

          <div className="mt-10 space-y-1">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group flex gap-5 py-5 border-t border-slate-200/60"
              >
                <span className="font-mono text-[12px] text-[#2563eb]/70 pt-1">{s.n}</span>
                <div className="flex-1">
                  <h3 className="text-[18px] font-medium text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-[14px] text-slate-500 leading-relaxed">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2 relative">
          <BillingFlowVisual />
        </div>
      </div>
    </section>
  );
}

function BillingFlowVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-10 bg-[radial-gradient(closest-side,rgba(37,99,235,0.08),transparent_70%)] blur-3xl" aria-hidden />
      <div className="relative card shine p-5 sm:p-7">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4">
          <span className="font-mono uppercase tracking-wider text-[#2563eb]/70">Live: bill timer</span>
          <span className="font-mono">00:00:27</span>
        </div>

        <div className="space-y-3">
          <FlowRow time="00:03" label="Party: Ramesh General Store" highlight />
          <FlowRow time="00:09" label="Basmati Rice 25kg × 4   = ₹7,400" />
          <FlowRow time="00:14" label="Sunflower Oil 15L × 2   = ₹3,280" />
          <FlowRow time="00:19" label="Toor Dal 30kg × 1   = ₹4,200" />
          <FlowRow time="00:22" label="GST 5% auto-applied — ₹811" muted />
          <FlowRow time="00:27" label="Pakka. Shared on WhatsApp ✓" success />
        </div>

        <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#2563eb]/[0.06] to-[#1d4ed8]/[0.03] ring-1 ring-[#2563eb]/15 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">WhatsApp message preview</p>
              <p className="mt-1 text-[13.5px] text-slate-800">Namaste Ramesh ji, aapka bill ₹17,030 ka taiyaar hai.</p>
            </div>
            <span className="font-mono text-[10px] text-[#2563eb] bg-[#2563eb]/[0.08] rounded-full px-2 py-1 ring-1 ring-[#2563eb]/15">UPI inside</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowRow({ time, label, highlight, muted, success }: { time: string; label: string; highlight?: boolean; muted?: boolean; success?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className={`flex items-center gap-4 rounded-xl px-3.5 py-2.5 ring-1 ${
        success ? "bg-emerald-50 ring-emerald-200/60" :
        highlight ? "bg-blue-50/60 ring-blue-200/40" :
        "bg-slate-50/60 ring-slate-200/40"
      }`}
    >
      <span className={`font-mono text-[11px] tabular-nums ${success ? "text-emerald-600" : "text-slate-400"}`}>{time}</span>
      <span className={`text-[13px] ${success ? "text-emerald-700" : muted ? "text-slate-400" : "text-slate-700"}`}>{label}</span>
    </motion.div>
  );
}
