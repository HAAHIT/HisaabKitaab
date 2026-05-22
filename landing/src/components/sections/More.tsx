"use client";
import { motion } from "framer-motion";
import { BankReconcileMockup, GstMockup, PurchaseOcrMockup } from "../mockups/MiniMockups";

export function MoreSection() {
  const items = [
    {
      tag: "Bank reconciliation",
      title: "Match every UPI ping to a voucher",
      body: "Upload a statement, SoloBooks fuzz-matches by amount + date + party. Unmatched lines surface — never hide.",
      mockup: <BankReconcileMockup />,
    },
    {
      tag: "Purchase bill OCR",
      title: "Snap supplier bills. Done.",
      body: "Gemini Flash extracts vendor, GSTIN, date and totals in under 2 seconds. Review once, save forever.",
      mockup: <PurchaseOcrMockup />,
    },
    {
      tag: "GST returns",
      title: "GSTR-3B, pre-filled",
      body: "Output, input credit and net payable computed live. Drilldown to the source bill in 1 tap.",
      mockup: <GstMockup />,
    },
  ];

  return (
    <section id="more" className="relative py-24 sm:py-32 overflow-hidden border-t border-white/5">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="divider-tick">04 — And then some</span>
          <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4">
            Everything else, <span className="text-white/55">just as quiet.</span>
          </h2>
          <p className="mt-5 text-[16px] text-white/65 leading-relaxed">
            Bank reconciliation, OCR-powered purchase entry, GST returns. No new dashboards to learn — they appear inside the flows you already know.
          </p>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <motion.div
              key={item.tag}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="flex flex-col gap-4"
            >
              {item.mockup}
              <div className="px-1">
                <p className="text-[10.5px] uppercase tracking-wider text-[#28e0a8] font-mono">{item.tag}</p>
                <h3 className="mt-1.5 text-[18px] font-medium text-white">{item.title}</h3>
                <p className="mt-1 text-[13px] text-white/55 leading-relaxed">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
