import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Import Data from TallyPrime into SoloBooks — Guide",
  description:
    "Step-by-step guide to migrate ledgers, parties, and historical GST vouchers from Tally ERP 9 / TallyPrime into SoloBooks without data loss.",
  keywords: [
    "import from Tally",
    "Tally to SoloBooks",
    "migrate Tally data",
    "Tally XML import",
    "Tally ledger import",
  ],
  alternates: { canonical: "/guides/import-from-tally" },
  openGraph: {
    title: "Import Tally Data into SoloBooks",
    description:
      "Migrate ledgers, parties, and vouchers from Tally into SoloBooks cleanly.",
    type: "article",
    url: "/guides/import-from-tally",
  },
};

export default function ImportFromTallyGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Import Data from TallyPrime into SoloBooks",
    description:
      "Migrate your existing ledgers, parties, and historical vouchers out of Tally and into SoloBooks.",
    step: [
      { "@type": "HowToStep", name: "Export Masters from Tally", text: "Open TallyPrime → Export > Masters → format XML. Generates Master.xml." },
      { "@type": "HowToStep", name: "Export Vouchers", text: "Export > Transactions → date range → XML. Generates DayBook.xml." },
      { "@type": "HowToStep", name: "Upload to SoloBooks", text: "Settings > Data Management > Import from Tally. Upload Master.xml then DayBook.xml." },
      { "@type": "HowToStep", name: "Verify and Confirm", text: "Review the parsed summary and click Confirm Import." },
    ],
  };

  const steps = [
    {
      n: 1,
      t: "Export Masters from Tally",
      d: (
        <>
          Open TallyPrime → <strong>Export → Masters</strong>. Set format to{" "}
          <strong>XML (Data Interchange)</strong>. Generates{" "}
          <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">Master.xml</code>{" "}
          containing all Ledgers, Stock Items, and Party details.
        </>
      ),
    },
    {
      n: 2,
      t: "Export Vouchers (historical data)",
      d: (
        <>
          Navigate to <strong>Export → Transactions</strong> or a specific Day Book / Register. Pick a date range and export as <strong>XML</strong>. Produces{" "}
          <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">DayBook.xml</code>.
        </>
      ),
    },
    {
      n: 3,
      t: "Upload to SoloBooks",
      d: (
        <>
          In your dashboard go to <strong>Settings → Data Management → Import from Tally</strong>. Upload <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">Master.xml</code> first, then <code className="font-mono text-[13px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">DayBook.xml</code>. Our parser handles structural mapping, balance validation, and GST checks automatically.
        </>
      ),
    },
    {
      n: 4,
      t: "Verify and confirm",
      d: (
        <>
          Review the summary of imported ledgers and vouchers. Click <strong>Confirm Import</strong> to write the records to your account. Trial balances should match Tally exactly.
        </>
      ),
    },
  ];

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
            Guide · Tally Import
          </span>
          <h1 className="mt-5 font-display text-[40px] sm:text-[60px] font-medium leading-[1.05] tracking-tight text-slate-900">
            Move from Tally<br />to SoloBooks.
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Migrate ledgers, parties, and historical vouchers out of TallyPrime — your trial balances will match to the rupee.
          </p>
        </div>
      </section>

      <article className="relative mx-auto max-w-3xl px-5 sm:px-8 pb-24">
        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-8 mb-3">
          Why migrate to SoloBooks?
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Moving from desktop Tally to a cloud-native platform gives you real-time access to your books anywhere — and tools built specifically for Indian MSMEs: GST, Udhar Khata, multilingual receipts, party reminders, and a workflow your CA already understands.
        </p>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-6">
          Step-by-step import
        </h2>

        <div className="space-y-6 mb-10">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6">
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

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 my-8">
          <div className="flex gap-3">
            <div className="flex-shrink-0 grid place-items-center h-9 w-9 rounded-full bg-blue-100 text-blue-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-blue-900 uppercase tracking-wider">Tip</p>
              <p className="mt-1 text-[14px] text-blue-900/80 leading-relaxed">
                Always upload <strong>Master.xml first</strong>. Vouchers reference ledgers and party names — if those don&apos;t exist yet, the import will reject mismatches.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 text-center pt-10 border-t border-slate-200">
          <Link href="/register" className="btn-primary">
            Start your migration
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
