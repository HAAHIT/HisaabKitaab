"use client";
import { motion } from "framer-motion";
import { UdharMockup } from "../mockups/UdharMockup";

export function UdharSection() {
  const bullets = [
    { t: "Biggest debtors first", d: "No alphabetical sorting nonsense. Open the app, see who owes you the most." },
    { t: "One-tap chase", d: "Call or WhatsApp from the row. The reminder message writes itself — in Hindi or English." },
    { t: "Bulk WhatsApp reminders", d: "Tap once on month-end. Every overdue party gets a personalized nudge with their balance." },
    { t: "Aapko bhi dena hai?", d: "Vendor balances live in the same place. Green = aap se lena, Red = aap ko dena." },
  ];

  return (
    <section id="udhar" className="relative py-24 sm:py-32 overflow-hidden border-t border-white/5">
      <div className="absolute -top-20 right-0 w-[400px] h-[400px] bg-[radial-gradient(closest-side,rgba(217,150,86,0.10),transparent_70%)] blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="flex justify-center"
        >
          <UdharMockup />
        </motion.div>

        <div>
          <span className="divider-tick">02 — Udhar Khata</span>
          <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4">
            "Sunita ne <span className="italic text-amber-300/90">paisa</span> diya kya?"
          </h2>
          <p className="mt-5 text-[16px] text-white/65 max-w-[520px] leading-relaxed">
            Open the app, see the answer in under 2 seconds. Udhar Khata is sorted by who owes you the most — not by alphabet. Every row has a call and WhatsApp shortcut. End-of-month reminders go out in one tap.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {bullets.map((b, i) => (
              <motion.div
                key={b.t}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#28e0a8]" />
                  <h3 className="text-[14px] font-medium text-white">{b.t}</h3>
                </div>
                <p className="mt-1.5 text-[12.5px] text-white/55 leading-relaxed">{b.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
