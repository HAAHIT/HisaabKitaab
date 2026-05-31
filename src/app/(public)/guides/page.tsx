import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in";

export const metadata: Metadata = {
  title: "Guides — GST Billing, Tally & Accounting for Indian Businesses",
  description:
    "Practical guides for Indian SMBs: export and import Tally data, file GSTR-1 and GSTR-3B, and run GST-compliant double-entry accounting with SoloBooks.",
  keywords: [
    "SoloBooks guides",
    "GST billing guide",
    "Tally export guide",
    "Tally import guide",
    "GSTR filing",
    "accounting guide India",
  ],
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "SoloBooks Guides",
    description:
      "Practical guides for GST billing, Tally compatibility, and accounting for Indian businesses.",
    type: "website",
    url: "/guides",
  },
};

const GUIDES = [
  {
    href: "/guides/export-to-tally",
    eyebrow: "Tally",
    title: "Export data from SoloBooks to TallyPrime",
    desc: "Generate GST-compliant Tally XML vouchers in one click and hand them to your CA — debit/credit splits and intra/inter-state tax handled correctly.",
  },
  {
    href: "/guides/import-from-tally",
    eyebrow: "Tally",
    title: "Import data from TallyPrime into SoloBooks",
    desc: "Migrate ledgers, parties, and historical vouchers out of Tally so your trial balances match to the rupee.",
  },
  {
    href: "/guides/gst-filing",
    eyebrow: "GST",
    title: "File GSTR-1 and GSTR-3B from SoloBooks",
    desc: "Understand how SoloBooks turns your daily billing into GSTR-1 and GSTR-3B summaries, and how to use them at filing time.",
  },
];

export default function GuidesIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "SoloBooks Guides",
        url: `${SITE_URL}/guides`,
        description:
          "Practical guides for GST billing, Tally compatibility, and accounting for Indian businesses.",
        hasPart: GUIDES.map((g) => ({
          "@type": "Article",
          name: g.title,
          url: `${SITE_URL}${g.href}`,
          abstract: g.desc,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        ],
      },
    ],
  };

  return (
    <main className="solobooks-landing min-h-screen relative">
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-medium text-blue-700 ring-1 ring-blue-200">
            Guides
          </span>
          <h1 className="mt-5 font-display text-[40px] sm:text-[60px] font-medium leading-[1.05] tracking-tight text-slate-900">
            Guides for GST billing<br />and Tally accounting.
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Practical, India-first walkthroughs for billing, GST returns, and keeping your books in sync with Tally.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-5 sm:px-8 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {GUIDES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
                {g.eyebrow}
              </span>
              <h2 className="mt-4 text-[19px] font-semibold text-slate-900 leading-snug">
                {g.title}
              </h2>
              <p className="mt-2 text-[14.5px] text-slate-600 leading-relaxed">
                {g.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-blue-700">
                Read guide
                <svg className="transition-transform group-hover:translate-x-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
