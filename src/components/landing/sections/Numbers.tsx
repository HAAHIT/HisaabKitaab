"use client";
import { motion } from "framer-motion";

const numbers = [
  { n: "30s", label: "Median time, party to shared bill", sub: "vs. 4–6 min in Vyapar" },
  { n: "12,400+", label: "Dukandaars across India", sub: "in 280 cities" },
  { n: "₹2.1Cr", label: "WhatsApp UPI links paid daily", sub: "average across May 2026" },
  { n: "0", label: "Times we say 'Debit' or 'Credit'", sub: "to a shopkeeper. Ever." },
];

export function NumbersSection() {
  return (
    <section className="relative py-24 sm:py-28 border-y border-slate-200/60">
      <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/60">
          {numbers.map((x, i) => (
            <motion.div
              key={x.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="px-4 md:px-7 py-7"
            >
              <p className="font-display text-[44px] sm:text-[60px] leading-none font-medium tracking-tight">
                <span className="bg-gradient-to-br from-slate-900 to-[#2563eb] bg-clip-text text-transparent">{x.n}</span>
              </p>
              <p className="mt-3 text-[13px] text-slate-600 leading-snug max-w-[200px]">{x.label}</p>
              <p className="mt-1 text-[11px] text-slate-400 font-mono">{x.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
