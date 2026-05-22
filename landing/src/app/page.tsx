import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { FastBilling } from "@/components/sections/FastBilling";
import { UdharSection } from "@/components/sections/Udhar";
import { TallySection } from "@/components/sections/Tally";
import { MoreSection } from "@/components/sections/More";
import { NumbersSection } from "@/components/sections/Numbers";
import { Testimonials } from "@/components/sections/Testimonials";
import { Pricing } from "@/components/sections/Pricing";
import { CTA } from "@/components/sections/CTA";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#07090a] text-white relative">
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
