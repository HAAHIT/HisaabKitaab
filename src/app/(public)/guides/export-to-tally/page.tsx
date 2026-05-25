import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Export Data from SoloBooks to TallyPrime — Guide",
  description:
    "Step-by-step guide to export GST-compliant vouchers, sales, and purchases from SoloBooks into Tally ERP 9 / TallyPrime XML format.",
  keywords: [
    "export to Tally",
    "SoloBooks Tally export",
    "Tally XML",
    "TallyPrime import",
    "GST voucher export",
  ],
  alternates: { canonical: "/guides/export-to-tally" },
  openGraph: {
    title: "Export SoloBooks Data to TallyPrime",
    description:
      "Sync daily billing and purchase data from SoloBooks into Tally for your CA.",
    type: "article",
    url: "/guides/export-to-tally",
  },
};

export default function ExportToTallyGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Export Data from SoloBooks to TallyPrime",
    description:
      "Syncing daily billing/purchases generated in our SaaS software back into Tally for the user's CA.",
    step: [
      { "@type": "HowToStep", name: "Generate the Export", text: "Go to Reports > Tally Export. Select your desired date range and click Generate XML." },
      { "@type": "HowToStep", name: "Send to CA", text: "Download TallyExport.xml and share it with your CA." },
      { "@type": "HowToStep", name: "Import into Tally", text: "Your CA goes to Import > Transactions in TallyPrime and imports the file." },
    ],
  };

  return (
    <main className="solobooks-landing min-h-screen relative">
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-medium text-blue-700 ring-1 ring-blue-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            Guide · Tally Export
          </span>
          <h1 className="mt-5 font-display text-[40px] sm:text-[60px] font-medium leading-[1.05] tracking-tight text-slate-900">
            Export SoloBooks data<br />into TallyPrime.
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            A clean handoff to your CA — generate GST-compliant Tally XML vouchers in one click, with debit/credit splits and intra/inter-state tax handled correctly.
          </p>
        </div>
      </section>

      <article className="relative mx-auto max-w-3xl px-5 sm:px-8 pb-24">
        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-8 mb-3">
          Seamless CA collaboration
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Your business runs on the cloud, but your Chartered Accountant likely still uses TallyPrime. SoloBooks bridges this gap with native Tally XML files — no manual data entry, no copy-paste.
        </p>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-3">
          Understanding the XML structure
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          SoloBooks constructs every export to adhere to strict Tally standards.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <code className="inline-block font-mono text-[12px] text-blue-700 bg-blue-50 px-2 py-1 rounded-md ring-1 ring-blue-100 mb-4">
              &lt;TALLYMESSAGE&gt;
            </code>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              Each voucher is wrapped in its own envelope. Atomic transaction integrity with precise ledger references — debit and credit totals always balance.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <code className="inline-block font-mono text-[12px] text-blue-700 bg-blue-50 px-2 py-1 rounded-md ring-1 ring-blue-100 mb-4">
              &lt;GSTDETAILS.LIST&gt;
            </code>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              GST compliance baked in. Accurate taxable values, CGST/SGST/IGST splits, and intra vs. inter-state tracking.
            </p>
          </div>
        </div>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-3">
          The accounting rule for sales
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Tally Sales Vouchers follow standard double-entry — &quot;Credit all Incomes and Gains&quot;:
        </p>
        <ul className="mt-4 space-y-2 text-[15.5px] text-slate-600 list-disc pl-6">
          <li><strong className="text-slate-900">Sales Account</strong>: always CREDIT.</li>
          <li><strong className="text-slate-900">Customer Account</strong>: always DEBIT (they receive goods, becoming a debtor).</li>
        </ul>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-3">
          How it looks in Tally XML
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Specify the entry side using <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">&lt;ISDEEMEDPOSITIVE&gt;</code> — Tally uses this instead of &quot;Debit&quot; / &quot;Credit&quot;.
        </p>

        <div className="overflow-x-auto my-8 rounded-2xl border border-slate-200">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 px-4 font-semibold text-slate-800">Ledger Type</th>
                <th className="py-3 px-4 font-semibold text-slate-800">Side</th>
                <th className="py-3 px-4 font-semibold text-slate-800">ISDEEMEDPOSITIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr><td className="py-3 px-4">Customer / Cash</td><td className="py-3 px-4">Debit</td><td className="py-3 px-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">Yes</span></td></tr>
              <tr><td className="py-3 px-4">Sales Ledger</td><td className="py-3 px-4">Credit</td><td className="py-3 px-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">No</span></td></tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 my-8">
          <div className="px-4 py-2.5 bg-slate-900 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">xml-example.xml</span>
          </div>
          <pre className="p-5 text-[13px] bg-slate-950 text-slate-300 font-mono overflow-x-auto leading-relaxed"><code>{`<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Customer Name</LEDGERNAME>
  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
  <AMOUNT>-5000.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>

<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Sales Account</LEDGERNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <AMOUNT>5000.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>`}</code></pre>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 my-8">
          <div className="flex gap-3">
            <div className="flex-shrink-0 grid place-items-center h-9 w-9 rounded-full bg-amber-100 text-amber-700">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-amber-900 uppercase tracking-wider">Watch out: the amount sign</p>
              <p className="mt-1 text-[14px] text-amber-800 leading-relaxed">
                Tally represents <strong>Debits as negative</strong> and <strong>Credits as positive</strong>. If you hit a &quot;Balance Mismatch&quot;, check that your customer amount is negative and sales amount is positive.
              </p>
            </div>
          </div>
        </div>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-6">
          Step-by-step export
        </h2>

        <div className="space-y-6 mb-10">
          {[
            { n: 1, t: "Generate the export", d: <>Go to <strong>Reports → Tally Export</strong>. Pick a date range and click <strong>Generate XML</strong>.</> },
            { n: 2, t: "Send to your CA", d: <>Download <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">TallyExport.xml</code> and share via email or direct link.</> },
            { n: 3, t: "Import into Tally", d: <>In TallyPrime go to <strong>Import → Transactions</strong>, pick the file, and all vouchers import instantly — no duplicates.</> },
          ].map((s) => (
            <div key={s.n} className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex-shrink-0 h-11 w-11 rounded-full bg-blue-50 ring-1 ring-blue-200 text-blue-700 flex items-center justify-center font-display text-[20px] font-semibold">
                {s.n}
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-slate-900 mb-1.5">{s.t}</h3>
                <p className="text-[14.5px] text-slate-600 leading-relaxed mb-0">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center pt-10 border-t border-slate-200">
          <Link href="/register" className="btn-primary">
            Try SoloBooks free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </Link>
          <p className="mt-6 text-[11.5px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Tally and TallyPrime are registered trademarks of Tally Solutions Pvt. Ltd. SoloBooks is an independent product, not affiliated with or endorsed by Tally Solutions.
          </p>
        </div>
      </article>

      <Footer />
    </main>
  );
}
