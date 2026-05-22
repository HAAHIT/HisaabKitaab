"use client";
import { motion } from "framer-motion";

const tiers = [
  {
    name: "Chhota",
    tag: "For new dukaans",
    price: "Free",
    sub: "Forever, for first 100 bills/month",
    features: ["WhatsApp bill share", "Udhar Khata for 50 parties", "Daily money-in/out summary", "1 user"],
    cta: "Start free",
    accent: false,
  },
  {
    name: "Pakka",
    tag: "Most popular",
    price: "₹299",
    suffix: "/month",
    sub: "Billed annually · ₹3,588/yr",
    features: ["Unlimited bills · parties", "Tally XML export + import", "Bank reconciliation", "Purchase bill OCR (Gemini)", "GST returns (3B, 1)", "Up to 3 users · Hindi/English"],
    cta: "Try free for 30 days",
    accent: true,
  },
  {
    name: "Bada",
    tag: "Multi-shop",
    price: "₹799",
    suffix: "/month",
    sub: "Per outlet · billed annually",
    features: ["Everything in Pakka", "Multi-tenant / multi-shop", "CA portal access", "Priority support", "Custom Tally ledger mapping", "Unlimited users"],
    cta: "Talk to sales",
    accent: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32 border-t border-white/5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#28e0a8]/30 to-transparent" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="divider-tick mx-auto justify-center" style={{ display: "inline-flex" }}>Pricing</span>
          <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4">
            Less than a chai a day.
          </h2>
          <p className="mt-4 text-[15.5px] text-white/60 max-w-md mx-auto">
            No setup fees. No "per-bill" tricks. Cancel anytime — your data stays yours, exported as Tally XML.
          </p>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className={`relative rounded-3xl p-7 border ${
                t.accent
                  ? "border-[#28e0a8]/30 bg-gradient-to-b from-[#28e0a8]/[0.08] to-transparent shadow-[0_40px_80px_-40px_rgba(40,224,168,0.35)]"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              {t.accent && (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-[#28e0a8] text-[#06140e] text-[10.5px] font-semibold px-2.5 py-1 font-mono uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#06140e]/60" /> {t.tag}
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] text-white">{t.name}</h3>
                {!t.accent && <span className="text-[10.5px] text-white/40 uppercase tracking-wider font-mono">{t.tag}</span>}
              </div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-[40px] font-medium leading-none text-white">{t.price}</span>
                {t.suffix && <span className="text-[14px] text-white/50">{t.suffix}</span>}
              </div>
              <p className="mt-1.5 text-[12px] text-white/45">{t.sub}</p>

              <ul className="mt-6 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/80">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28e0a8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0"><path d="m5 12 5 5L20 7"/></svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`mt-7 w-full rounded-full py-3 text-[13.5px] font-semibold transition ${
                  t.accent
                    ? "bg-[#28e0a8] text-[#06140e] hover:brightness-110"
                    : "bg-white/5 ring-1 ring-white/10 text-white hover:bg-white/10"
                }`}
              >
                {t.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
