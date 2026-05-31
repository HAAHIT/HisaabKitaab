"use client";
import "./landing.css";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { TrustStrip } from "./sections/TrustStrip";
import { FastBilling } from "./sections/FastBilling";
import { UdharSection } from "./sections/Udhar";
import { TallySection } from "./sections/Tally";
import { MoreSection } from "./sections/More";
import { NumbersSection } from "./sections/Numbers";
import { Testimonials } from "./sections/Testimonials";
import { Pricing } from "./sections/Pricing";
import { CTA } from "./sections/CTA";
import { Footer } from "./Footer";
import { SmoothScroll } from "./SmoothScroll";
import { Reveal } from "./Reveal";
import { FAQ, type FaqItem } from "./FAQ";

const FAQS: FaqItem[] = [
  {
    q: "Is SoloBooks free to use?",
    a: "Yes. SoloBooks is free for your first 100 bills every month, with no credit card required. You can create GST invoices, track party ledgers, and export to Tally on the free tier.",
  },
  {
    q: "Is SoloBooks compatible with Tally ERP 9 and TallyPrime?",
    a: "Yes. SoloBooks exports your sales, purchases, and payment vouchers as native Tally XML that imports directly into Tally ERP 9 or TallyPrime, with correct debit/credit splits and CGST/SGST/IGST tax handling. You can also import your existing ledgers and vouchers from Tally into SoloBooks.",
  },
  {
    q: "Does SoloBooks handle GST and GSTR filing?",
    a: "Yes. SoloBooks applies CGST and SGST for intra-state sales and IGST for inter-state sales automatically, and generates GSTR-1 and GSTR-3B summaries from your billing data so filing is straightforward.",
  },
  {
    q: "Can I use SoloBooks in Hindi?",
    a: "Yes. SoloBooks works in both Hindi and English, including bilingual receipts, so you and your customers can use whichever language is comfortable.",
  },
  {
    q: "Does SoloBooks work offline?",
    a: "Yes. SoloBooks is a Progressive Web App (PWA) that you can install on your phone or computer and keep using even when your internet connection drops.",
  },
  {
    q: "Who is SoloBooks built for?",
    a: "SoloBooks is built for Indian small and medium businesses (MSMEs) — shopkeepers, traders, and service providers — and the Chartered Accountants who manage their books in Tally.",
  },
];

export function LandingPage() {
  return (
    <main className="solobooks-landing min-h-screen relative">
      {/* Crawler / no-JS safeguard: force all animated landing content visible when
          JS does not run, so generative engines and non-rendering crawlers never
          miss text that scroll/reveal animations would otherwise fade in. */}
      <noscript>
        <style>{`.solobooks-landing * { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
      <SmoothScroll />
      <Nav />
      <Hero />
      <Reveal stagger={false}><TrustStrip /></Reveal>
      <Reveal stagger={false}><FastBilling /></Reveal>
      <Reveal stagger={false}><UdharSection /></Reveal>
      <Reveal stagger={false}><TallySection /></Reveal>
      <Reveal stagger={false}><MoreSection /></Reveal>
      <Reveal stagger={false}><NumbersSection /></Reveal>
      <Reveal stagger={false}><Testimonials /></Reveal>
      <Reveal stagger={false}><Pricing /></Reveal>
      <Reveal stagger={false}><FAQ items={FAQS} /></Reveal>
      <Reveal stagger={false}><CTA /></Reveal>
      <Footer />
    </main>
  );
}
