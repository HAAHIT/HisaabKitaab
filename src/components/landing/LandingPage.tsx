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

export function LandingPage() {
  return (
    <main className="solobooks-landing min-h-screen relative">
      <Nav />
      <Hero />
      <TrustStrip />
      <FastBilling />
      <UdharSection />
      <TallySection />
      <MoreSection />
      <NumbersSection />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
