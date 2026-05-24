import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Terms of Use | SoloBooks",
  description:
    "The terms that govern your use of SoloBooks — billing, Udhar Khata, Tally export and import, and GST accounting for Indian businesses.",
};

const LAST_UPDATED = "May 24, 2026";

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "agreement",
    title: "1. Agreement to Terms",
    body: (
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) form a binding agreement between you (&ldquo;you&rdquo;,
        &ldquo;your business&rdquo;) and SoloBooks Technologies Pvt. Ltd. (&ldquo;SoloBooks&rdquo;,
        &ldquo;we&rdquo;, &ldquo;our&rdquo;) governing your access to and use of the SoloBooks website,
        applications, and APIs (the &ldquo;Service&rdquo;). By creating an account or using the Service,
        you agree to these Terms and to our Privacy Policy.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility & Accounts",
    body: (
      <>
        <ul>
          <li>You must be at least 18 years of age and capable of forming a binding contract under Indian law.</li>
          <li>You agree to provide accurate business details, including legal name, GSTIN where applicable, and a valid mobile number and email.</li>
          <li>You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</li>
          <li>You must promptly notify us of any suspected unauthorised access.</li>
        </ul>
      </>
    ),
  },
  {
    id: "subscription",
    title: "3. Subscription, Billing & Taxes",
    body: (
      <>
        <p>
          SoloBooks is offered on a subscription basis. Fees, billing cycle, and feature limits are described
          on the pricing page or in your order form. Unless stated otherwise:
        </p>
        <ul>
          <li>Subscriptions auto-renew at the end of each billing period until cancelled.</li>
          <li>Fees are stated exclusive of GST; applicable taxes will be added on the invoice.</li>
          <li>You authorise us (and our payment processors) to charge your selected payment method.</li>
          <li>Failure to pay may result in suspension of the Service after reasonable notice.</li>
        </ul>
      </>
    ),
  },
  {
    id: "trial",
    title: "4. Free Trial",
    body: (
      <p>
        We may offer a free trial. At the end of the trial period your workspace will either move to a paid
        plan you selected, or transition to a limited read-only state until you choose a plan. Trial usage
        is subject to the same Terms.
      </p>
    ),
  },
  {
    id: "refunds",
    title: "5. Refunds",
    body: (
      <p>
        Subscription fees are generally non-refundable. We may, at our discretion, offer pro-rated refunds
        for unused periods within the first 14 days of a new annual plan, where the Service has not been
        materially used. Refunds, if any, are processed to the original payment method within 7&ndash;10
        business days.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to record fraudulent transactions, evade tax, or misrepresent accounts.</li>
          <li>Reverse engineer, decompile, or attempt to extract source code of the Service.</li>
          <li>Probe, scan, or test the vulnerability of any part of the Service without prior written consent.</li>
          <li>Circumvent tenant isolation, rate limits, role-based access controls, or audit logging.</li>
          <li>Upload malware, illegal content, or content that infringes third-party rights.</li>
          <li>Resell or sublicense the Service except through a SoloBooks reseller or CA partner agreement.</li>
        </ul>
      </>
    ),
  },
  {
    id: "your-data",
    title: "7. Your Data & Books",
    body: (
      <>
        <p>
          You retain all rights to the data, books, vouchers, and content you submit to the Service
          (&ldquo;Customer Data&rdquo;). You grant SoloBooks a limited, non-exclusive licence to host,
          process, transmit, back up, and display Customer Data solely to operate and improve the Service
          for you.
        </p>
        <p>
          You are responsible for the accuracy and legality of your Customer Data and for ensuring your use
          of the Service complies with the Income Tax Act, 1961, the CGST Act, 2017, and other applicable
          laws.
        </p>
      </>
    ),
  },
  {
    id: "tally",
    title: "8. Tally Compatibility, Imports & Exports",
    body: (
      <>
        <p>
          The Service generates double-entry journal entries and Tally-compatible XML vouchers to support
          interoperability with Tally ERP 9 and Tally Prime. While we make reasonable efforts to align with
          published Tally schemas, you are responsible for verifying that imported and exported data matches
          your statutory books before filing.
        </p>
        <p>
          Tally&reg; is a registered trademark of Tally Solutions Pvt. Ltd. SoloBooks is independent and is
          not affiliated with, endorsed by, or sponsored by Tally Solutions.
        </p>
      </>
    ),
  },
  {
    id: "gst",
    title: "9. GST, Statutory Filings & Professional Advice",
    body: (
      <p>
        SoloBooks provides tools to compute GST liabilities, generate invoices, and prepare data for GSTR-1
        and GSTR-3B. We are a software platform and not a tax advisor, Chartered Accountant, or auditor.
        The Service does not constitute legal, tax, or accounting advice. You should consult your CA before
        filing returns.
      </p>
    ),
  },
  {
    id: "ip",
    title: "10. Intellectual Property",
    body: (
      <p>
        The Service, including its software, design, documentation, and the SoloBooks marks, is owned by
        SoloBooks Technologies Pvt. Ltd. and protected by Indian and international intellectual property
        laws. Except for the rights expressly granted in these Terms, no licence is granted to you.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "11. Third-Party Services",
    body: (
      <p>
        The Service may integrate with third-party services (payment gateways, OCR providers, WhatsApp,
        bank statement parsers, email delivery, etc.). Your use of those services is subject to their
        respective terms, and SoloBooks is not responsible for their content, security, or availability.
      </p>
    ),
  },
  {
    id: "availability",
    title: "12. Service Availability",
    body: (
      <p>
        We strive to keep the Service available 24x7 but do not guarantee uninterrupted access. Scheduled
        maintenance will be communicated where reasonably practicable. We are not liable for downtime
        caused by events outside our reasonable control.
      </p>
    ),
  },
  {
    id: "suspension",
    title: "13. Suspension & Termination",
    body: (
      <>
        <p>
          We may suspend or terminate your access to the Service if you breach these Terms, fail to pay
          fees, or use the Service in a way that risks harm to other customers or to the platform. You may
          cancel at any time from your workspace settings.
        </p>
        <p>
          On termination, you may export your data for 30 days. After that period, data may be archived in
          accordance with our retention policy and applicable law.
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "14. Disclaimer of Warranties",
    body: (
      <p>
        The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the
        maximum extent permitted by law, SoloBooks disclaims all warranties, whether express, implied or
        statutory, including warranties of merchantability, fitness for a particular purpose, and
        non-infringement. SoloBooks does not warrant that the Service will be error-free, fully secure, or
        that all statutory computations will be perfect for every fact pattern.
      </p>
    ),
  },
  {
    id: "liability",
    title: "15. Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, SoloBooks&apos; aggregate liability arising out of or in
        connection with the Service shall not exceed the fees paid by you to SoloBooks in the twelve (12)
        months immediately preceding the event giving rise to the claim. In no event shall SoloBooks be
        liable for indirect, incidental, special, consequential, or punitive damages, loss of profits, loss
        of business, or loss of data.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "16. Indemnity",
    body: (
      <p>
        You agree to indemnify and hold SoloBooks harmless from any claim, demand, or expense arising from
        your Customer Data, your breach of these Terms, or your violation of any law or third-party right.
      </p>
    ),
  },
  {
    id: "law",
    title: "17. Governing Law & Jurisdiction",
    body: (
      <p>
        These Terms are governed by the laws of India. Subject to the dispute-resolution clause below, the
        courts at Bengaluru, Karnataka shall have exclusive jurisdiction.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "18. Dispute Resolution",
    body: (
      <p>
        Any dispute arising out of these Terms shall first be attempted to be resolved by good-faith
        discussions for 30 days. If unresolved, the dispute shall be referred to arbitration by a sole
        arbitrator under the Arbitration and Conciliation Act, 1996, seated in Bengaluru, conducted in
        English.
      </p>
    ),
  },
  {
    id: "changes",
    title: "19. Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. Material changes will be notified by email or
        in-product at least 7 days before they take effect. Continued use of the Service after the
        effective date constitutes acceptance of the revised Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "20. Contact",
    body: (
      <p className="font-mono text-[13px] leading-relaxed">
        SoloBooks Technologies Pvt. Ltd.<br />
        Email: legal@solobooks.in
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="solobooks-landing legal-page min-h-screen relative bg-white">
      <Nav />

      <section className="relative pt-32 pb-16 px-5 sm:px-8">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="divider-tick">Legal &middot; Terms</span>
          <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.05] text-slate-900 mt-5">
            Terms of Use
          </h1>
          <p className="mt-5 text-[15px] text-slate-500 max-w-xl mx-auto leading-relaxed">
            The terms that govern your use of SoloBooks &mdash; billing, Udhar Khata, GST, and Tally-compatible
            bookkeeping for Indian businesses.
          </p>
          <p className="mt-4 text-[12px] font-mono uppercase tracking-[0.18em] text-slate-400">
            Last updated &middot; {LAST_UPDATED}
          </p>
        </div>
      </section>

      <section className="relative pb-24 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-[260px_1fr] gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-mono mb-4">
                Contents
              </p>
              <nav className="flex flex-col gap-1.5 text-[13.5px] text-slate-500">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="px-3 py-1.5 rounded-lg hover:text-slate-900 hover:bg-slate-100">
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="card shine p-8 sm:p-12">
            <div className="space-y-12 text-[15px] leading-[1.75] text-slate-600 [&_h2]:font-display [&_h2]:text-slate-900 [&_h2]:text-[24px] [&_h2]:mb-4 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:mb-4 [&_strong]:text-slate-800">
              {sections.map((s) => (
                <div key={s.id} id={s.id} className="scroll-mt-24">
                  <h2>{s.title}</h2>
                  {s.body}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
