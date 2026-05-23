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
      body: "Snap a photo, we extract vendor, GSTIN, date and totals in seconds. Review once, save forever.",
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
    <section id="more" className="relative py-24 sm:py-32 overflow-hidden border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="divider-tick">04 — And then some</span>
          <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4 text-slate-900">
            Everything else, <span className="text-slate-400">just as quiet.</span>
          </h2>
          <p className="mt-5 text-[16px] text-slate-500 leading-relaxed">
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
                <p className="text-[10.5px] uppercase tracking-wider text-[#2563eb] font-mono">{item.tag}</p>
                <h3 className="mt-1.5 text-[18px] font-medium text-slate-800">{item.title}</h3>
                <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {extras.map((x, i) => (
            <motion.div
              key={x.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="rounded-2xl border border-slate-200/60 bg-white p-5"
            >
              <div className="h-8 w-8 rounded-lg bg-[#2563eb]/[0.08] ring-1 ring-[#2563eb]/15 text-[#2563eb] grid place-items-center">
                {x.icon}
              </div>
              <h3 className="mt-3 text-[14.5px] font-medium text-slate-800">{x.title}</h3>
              <p className="mt-1 text-[12.5px] text-slate-500 leading-relaxed">{x.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const extras = [
  {
    title: "Credit notes",
    body: "Returns and refunds raise a credit note, reverse the journal, and update the party balance — all in one tap.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
    ),
  },
  {
    title: "CA-ready Excel reports",
    body: "Trial balance, party ledger, and transaction lists export to Excel — your CA opens them without setup.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13l3 3 3-3"/></svg>
    ),
  },
  {
    title: "Owner + accountant roles",
    body: "Invite your CA with accountant access. They see the books, you keep control of billing and pricing.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6M19 8v6"/></svg>
    ),
  },
  {
    title: "Receipt & payment vouchers",
    body: "Every paisa in and out is a balanced voucher. Match cash, bank or UPI to the bill it settled.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/></svg>
    ),
  },
  {
    title: "Multiple bank & UPI accounts",
    body: "Add every account you actually use. UPI handles, current accounts, cash drawer — track balances separately.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M3 10l9-6 9 6"/><path d="M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"/></svg>
    ),
  },
  {
    title: "Items catalog & bill templates",
    body: "Save items with HSN and GST rate. Customize bill layouts for your shop — print or share, same one tap.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
    ),
  },
];
