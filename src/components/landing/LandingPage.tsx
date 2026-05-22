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
import { Cursor } from "./Cursor";
import { Reveal } from "./Reveal";

export function LandingPage() {
  return (
    <main className="solobooks-landing min-h-screen relative">
      <SmoothScroll />
      <Cursor />
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
      <Reveal stagger={false}><CTA /></Reveal>
      <Footer />
    </main>
  );
}
