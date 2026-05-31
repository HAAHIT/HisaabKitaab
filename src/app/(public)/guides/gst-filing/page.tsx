import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { FAQ, type FaqItem } from "@/components/landing/FAQ";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in";

export const metadata: Metadata = {
  title: "File GSTR-1 and GSTR-3B from SoloBooks — Guide",
  description:
    "Understand GSTR-1 and GSTR-3B and how SoloBooks turns your daily GST billing into ready-to-file return summaries for Indian businesses.",
  keywords: [
    "GSTR-1",
    "GSTR-3B",
    "GST return filing",
    "GST filing India",
    "SoloBooks GST reports",
    "outward supplies return",
  ],
  alternates: { canonical: "/guides/gst-filing" },
  openGraph: {
    title: "File GSTR-1 and GSTR-3B from SoloBooks",
    description:
      "How SoloBooks turns daily billing into GSTR-1 and GSTR-3B summaries for Indian businesses.",
    type: "article",
    url: "/guides/gst-filing",
  },
};

const FAQS: FaqItem[] = [
  {
    q: "What is the difference between GSTR-1 and GSTR-3B?",
    a: "GSTR-1 is a detailed return of your outward supplies (sales), reported invoice by invoice. GSTR-3B is a summary return where you declare total taxable value, output tax, input tax credit, and the net GST payable for the period. Most businesses file both.",
  },
  {
    q: "Does SoloBooks file GST returns directly with the GST portal?",
    a: "SoloBooks prepares GSTR-1 and GSTR-3B summaries from your billing data so you or your CA can file accurately on the GST portal. It organises taxable value and CGST/SGST/IGST totals; the final submission is made on the government portal.",
  },
  {
    q: "How does SoloBooks decide between CGST/SGST and IGST?",
    a: "SoloBooks applies CGST and SGST (a 50/50 split) for intra-state supplies, where the customer is in the same state, and IGST (the full rate) for inter-state supplies. This is determined automatically from the place of supply on each bill.",
  },
  {
    q: "What is the Indian GST filing period?",
    a: "GST returns are generally filed monthly or quarterly depending on your turnover and scheme. SoloBooks aligns reports to the Indian financial year, which runs from April 1 to March 31, with quarters Apr–Jun, Jul–Sep, Oct–Dec, and Jan–Mar.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "File GSTR-1 and GSTR-3B from SoloBooks",
      description:
        "How SoloBooks turns your daily GST billing into ready-to-file GSTR-1 and GSTR-3B summaries.",
      author: { "@type": "Organization", name: "SoloBooks" },
      publisher: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: `${SITE_URL}/guides/gst-filing`,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: "File GSTR-1 and GSTR-3B", item: `${SITE_URL}/guides/gst-filing` },
      ],
    },
  ],
};

export default function GstFilingGuide() {
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
            Guide · GST Filing
          </span>
          <h1 className="mt-5 font-display text-[40px] sm:text-[60px] font-medium leading-[1.05] tracking-tight text-slate-900">
            File GSTR-1 &amp; GSTR-3B<br />without the spreadsheet.
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Every bill you raise in SoloBooks already carries the GST detail your returns need. Here is how that rolls up into GSTR-1 and GSTR-3B.
          </p>
        </div>
      </section>

      <article className="relative mx-auto max-w-3xl px-5 sm:px-8 pb-24">
        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-8 mb-3">
          GSTR-1 vs GSTR-3B
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          GST filing in India centres on two returns. <strong>GSTR-1</strong> reports your outward supplies — every sales invoice, broken down by GSTIN, taxable value, and tax rate. <strong>GSTR-3B</strong> is the summary return: total taxable turnover, output tax, input tax credit claimed, and the net GST you pay for the period.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-[13px] font-semibold text-blue-700 uppercase tracking-wider mb-2">GSTR-1</p>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              Invoice-level detail of all outward supplies. Drives your customers&apos; input tax credit, so accuracy matters.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-[13px] font-semibold text-blue-700 uppercase tracking-wider mb-2">GSTR-3B</p>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              Period summary of output tax, input credit, and net liability. This is what determines how much GST you actually pay.
            </p>
          </div>
        </div>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-3">
          How SoloBooks builds your returns
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Because every bill posts a balanced double-entry journal with the right tax ledgers, SoloBooks can aggregate the period for you. Intra-state sales split into <strong>CGST + SGST</strong>; inter-state sales use <strong>IGST</strong>. The report rolls taxable value and tax up per rate slab, ready to reconcile against the GST portal.
        </p>

        <ul className="mt-4 space-y-2 text-[15.5px] text-slate-600 list-disc pl-6">
          <li><strong className="text-slate-900">Taxable value</strong> totalled per GST rate.</li>
          <li><strong className="text-slate-900">Output tax</strong> separated into CGST, SGST, and IGST.</li>
          <li><strong className="text-slate-900">Place of supply</strong> determines intra- vs inter-state automatically.</li>
        </ul>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 my-8">
          <div className="flex gap-3">
            <div className="flex-shrink-0 grid place-items-center h-9 w-9 rounded-full bg-blue-100 text-blue-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-blue-900 uppercase tracking-wider">Good to know</p>
              <p className="mt-1 text-[14px] text-blue-900/80 leading-relaxed">
                SoloBooks reports follow the Indian financial year (April 1 – March 31). Quarters are Apr–Jun, Jul–Sep, Oct–Dec, and Jan–Mar — matching the periods you select on the GST portal.
              </p>
            </div>
          </div>
        </div>

        <h2 className="font-display text-[28px] sm:text-[34px] font-medium tracking-tight text-slate-900 mt-14 mb-3">
          At filing time
        </h2>
        <p className="text-[15.5px] text-slate-600 leading-relaxed">
          Open <strong>Reports → GST</strong>, pick your return period, and review the GSTR-1 and GSTR-3B summaries. Use them to file on the GST portal yourself, or hand them — along with a one-click <Link href="/guides/export-to-tally" className="text-blue-700 underline underline-offset-2">Tally export</Link> — to your Chartered Accountant.
        </p>

        <div className="mt-14 text-center pt-10 border-t border-slate-200">
          <Link href="/register" className="btn-primary">
            Start billing with GST built in
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </Link>
          <p className="mt-6 text-[11.5px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
            SoloBooks helps prepare GST return summaries. Final filing is made on the official GST portal; consult your Chartered Accountant for advice specific to your business.
          </p>
        </div>
      </article>

      <FAQ items={FAQS} heading="GST filing — common questions" />

      <Footer />
    </main>
  );
}
