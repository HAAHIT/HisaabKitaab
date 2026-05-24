import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of SoloBooks — billing, Udhar Khata, Tally export and import, and GST accounting for Indian businesses.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "May 24, 2026";

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "agreement",
    title: "1. Agreement to Terms",
    body: (
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) form a binding agreement between you, the entity or
        individual subscribing to the Service (&ldquo;you&rdquo;, &ldquo;your business&rdquo;, &ldquo;Customer&rdquo;)
        and SoloBooks Technologies Pvt. Ltd., a company incorporated in India with CIN U72900KA2024PTC178945
        (&ldquo;SoloBooks&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) governing your access to and use of the
        SoloBooks website, applications, and APIs (the &ldquo;Service&rdquo;). By creating an account, clicking
        &ldquo;I agree&rdquo;, or using the Service, you confirm that you have read these Terms and our Privacy
        Policy and you accept them. If you do not agree, you must not use the Service.
      </p>
    ),
  },
  {
    id: "definitions",
    title: "2. Definitions",
    body: (
      <ul>
        <li><strong>Service</strong> &mdash; the SoloBooks platform, including web app, mobile apps, APIs, and related documentation.</li>
        <li><strong>Order</strong> &mdash; the online checkout, plan selection, or signed order form pursuant to which you subscribe.</li>
        <li><strong>Subscription Term</strong> &mdash; the period of your paid subscription as set out in your Order, including any renewals.</li>
        <li><strong>Customer Data</strong> &mdash; the books, vouchers, parties, items, payments, journal entries, and other content you submit to the Service.</li>
        <li><strong>Authorised User</strong> &mdash; an individual you invite to your workspace under an assigned role.</li>
        <li><strong>Documentation</strong> &mdash; the user guides published at <span className="font-mono">solobooks.in/guides</span>.</li>
      </ul>
    ),
  },
  {
    id: "eligibility",
    title: "3. Eligibility & Accounts",
    body: (
      <ul>
        <li>You must be at least 18 years of age and capable of forming a binding contract under Indian law.</li>
        <li>You agree to provide accurate business details, including legal name, GSTIN where applicable, and a valid mobile number and email.</li>
        <li>You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</li>
        <li>You must promptly notify us of any suspected unauthorised access by writing to <span className="font-mono">security@solobooks.in</span>.</li>
        <li>You may invite Authorised Users under the Admin, Accountant, Salesperson, or Viewer role. You are responsible for their compliance with these Terms.</li>
      </ul>
    ),
  },
  {
    id: "subscription",
    title: "4. Subscription, Plans & Renewal",
    body: (
      <>
        <p>
          SoloBooks is offered on a subscription basis. The currently available plans, feature limits, and
          fees are published at <span className="font-mono">solobooks.in/pricing</span> (the &ldquo;Pricing
          Page&rdquo;), which is incorporated into these Terms by reference. Unless your Order states
          otherwise:
        </p>
        <ul>
          <li>Plans renew automatically at the end of each Subscription Term at the then-current rates published on the Pricing Page.</li>
          <li>We will notify you of any rate change at least 30 days before the next renewal. You may cancel before renewal to avoid the new rate.</li>
          <li>You may upgrade at any time; the upgrade price is pro-rated for the remainder of the current Subscription Term.</li>
          <li>You may downgrade or cancel at the end of the current Subscription Term; no pro-rated refunds for downgrades.</li>
          <li>Annual plans are billed up-front; monthly plans are billed monthly in advance.</li>
        </ul>
      </>
    ),
  },
  {
    id: "billing",
    title: "5. Fees, Invoicing & Taxes",
    body: (
      <ul>
        <li>Fees are stated in Indian Rupees (INR) and are exclusive of GST. Applicable GST will be added on the tax invoice we issue.</li>
        <li>You authorise SoloBooks and its payment processors to charge your selected payment method (card, UPI mandate, NACH) on each billing date.</li>
        <li>If a charge is declined, we will retry up to three times over seven days and notify you. Continued failure may result in suspension under Section 14.</li>
        <li>Invoices are due immediately on issue. Undisputed overdue amounts accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.</li>
        <li>You are responsible for any withholding taxes (TDS). If you deduct TDS, you must furnish a valid TDS certificate within 30 days.</li>
      </ul>
    ),
  },
  {
    id: "trial",
    title: "6. Free Trial",
    body: (
      <p>
        We may offer a free trial of up to 14 days. At the end of the trial period, your workspace will
        either move to a paid plan you have selected, or transition to a limited read-only state until you
        choose a plan. Trial usage is subject to the same Terms, except that the warranties in Section 16
        are further limited &mdash; the trial is provided strictly &ldquo;as is&rdquo; and without any service
        commitments.
      </p>
    ),
  },
  {
    id: "refunds",
    title: "7. Refunds",
    body: (
      <>
        <p>Subscription fees are generally non-refundable. The following exceptions apply:</p>
        <ul>
          <li><strong>14-day annual refund:</strong> For first-time annual subscribers, you may request a full refund within 14 days of the initial payment if you have not used the Service in a material way (no bills posted, no vouchers exported).</li>
          <li><strong>Service unavailability:</strong> If we materially fail to meet the SLA in Section 13, you may claim the service credit set out there.</li>
          <li><strong>Duplicate charges:</strong> Refunded in full within 7 business days of confirmation.</li>
        </ul>
        <p>
          Approved refunds are processed to the original payment method within 7&ndash;10 business days.
          Add-on fees (SMS bundles, WhatsApp template credits, OCR pages) are non-refundable once
          consumed.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "8. Acceptable Use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to record fraudulent transactions, evade tax, or misrepresent accounts.</li>
          <li>Reverse engineer, decompile, or attempt to extract source code of the Service.</li>
          <li>Probe, scan, or test the vulnerability of any part of the Service without prior written consent under our responsible-disclosure policy at <span className="font-mono">security@solobooks.in</span>.</li>
          <li>Circumvent tenant isolation, rate limits, role-based access controls, or audit logging.</li>
          <li>Upload malware, illegal content, or content that infringes third-party rights.</li>
          <li>Resell or sublicense the Service except through a SoloBooks reseller or CA partner agreement.</li>
          <li>Use the Service to send unsolicited bulk communications in violation of TRAI regulations.</li>
        </ul>
      </>
    ),
  },
  {
    id: "your-data",
    title: "9. Your Data & Books",
    body: (
      <>
        <p>
          You retain all rights to Customer Data. You grant SoloBooks a worldwide, royalty-free,
          non-exclusive licence to host, copy, process, transmit, back up, and display Customer Data
          solely to operate and improve the Service for you and to comply with law.
        </p>
        <p>
          You represent that you have all rights necessary to submit Customer Data to the Service and that
          Customer Data does not infringe third-party rights or violate applicable law. You are
          responsible for the accuracy and legality of Customer Data and for ensuring your use of the
          Service complies with the Income Tax Act, 1961, the CGST Act, 2017, and other applicable laws.
        </p>
      </>
    ),
  },
  {
    id: "tally",
    title: "10. Tally Compatibility, Imports & Exports",
    body: (
      <>
        <p>
          The Service generates double-entry journal entries and Tally-compatible XML vouchers to support
          interoperability with Tally ERP 9 and Tally Prime. While we make reasonable efforts to align
          with published Tally schemas, you are responsible for verifying that imported and exported data
          matches your statutory books before filing.
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
    title: "11. GST, Statutory Filings & Professional Advice",
    body: (
      <p>
        SoloBooks provides tools to compute GST liabilities, generate invoices, and prepare data for GSTR-1
        and GSTR-3B. We are a software platform and not a tax advisor, Chartered Accountant, or auditor.
        The Service does not constitute legal, tax, or accounting advice. You should consult your CA
        before filing returns. SoloBooks is not responsible for any penalty, interest, or assessment
        arising from your filings.
      </p>
    ),
  },
  {
    id: "ip",
    title: "12. Intellectual Property",
    body: (
      <p>
        The Service, including its software, design, documentation, and the SoloBooks marks, is owned by
        SoloBooks Technologies Pvt. Ltd. and protected by Indian and international intellectual property
        laws. We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use
        the Service during the Subscription Term solely for your internal business purposes. No other
        licence is granted, by implication or otherwise.
      </p>
    ),
  },
  {
    id: "feedback",
    title: "13. Feedback",
    body: (
      <p>
        If you provide suggestions, ideas, or feedback about the Service, you grant SoloBooks a perpetual,
        irrevocable, royalty-free, worldwide licence to use that feedback for any purpose, including
        improving the Service, without any obligation to you.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "14. Third-Party Services",
    body: (
      <p>
        The Service may integrate with third-party services (payment gateways, OCR providers, WhatsApp,
        bank statement parsers, email delivery, etc.). Your use of those services is subject to their
        respective terms, and SoloBooks is not responsible for their content, security, or availability.
        Discontinuation of a third-party integration is not a breach of these Terms, though we will
        provide reasonable notice where practicable.
      </p>
    ),
  },
  {
    id: "sla",
    title: "15. Service Availability & Support",
    body: (
      <>
        <p>
          We target a monthly uptime of <strong>99.9%</strong> for the production Service, measured
          excluding (a) scheduled maintenance announced at least 48 hours in advance, (b) emergency
          maintenance, and (c) factors outside our reasonable control (Section 24).
        </p>
        <p>
          If monthly uptime falls below 99.9% in a billing month, you may claim a service credit applied to
          your next invoice:
        </p>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-mono">
                <th className="px-3 py-2 border-b border-slate-200">Monthly Uptime</th>
                <th className="px-3 py-2 border-b border-slate-200">Service Credit</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr><td className="px-3 py-2 border-b border-slate-100">&lt; 99.9% but &ge; 99.0%</td><td className="px-3 py-2 border-b border-slate-100">10% of that month&apos;s fees</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">&lt; 99.0% but &ge; 95.0%</td><td className="px-3 py-2 border-b border-slate-100">25% of that month&apos;s fees</td></tr>
              <tr><td className="px-3 py-2">&lt; 95.0%</td><td className="px-3 py-2">50% of that month&apos;s fees</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Credits are your sole and exclusive remedy for unavailability. To claim, write to
          <span className="font-mono"> support@solobooks.in</span> within 30 days of the affected month.
        </p>
        <p className="font-display text-slate-900 text-[17px] mt-6 mb-2">Support response times</p>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-mono">
                <th className="px-3 py-2 border-b border-slate-200">Severity</th>
                <th className="px-3 py-2 border-b border-slate-200">Description</th>
                <th className="px-3 py-2 border-b border-slate-200">First Response</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr><td className="px-3 py-2 border-b border-slate-100">P1 &mdash; Critical</td><td className="px-3 py-2 border-b border-slate-100">Service unavailable for all users</td><td className="px-3 py-2 border-b border-slate-100">1 business hour</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">P2 &mdash; High</td><td className="px-3 py-2 border-b border-slate-100">Major feature broken; no workaround</td><td className="px-3 py-2 border-b border-slate-100">4 business hours</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">P3 &mdash; Normal</td><td className="px-3 py-2 border-b border-slate-100">Feature degraded; workaround exists</td><td className="px-3 py-2 border-b border-slate-100">1 business day</td></tr>
              <tr><td className="px-3 py-2">P4 &mdash; Low</td><td className="px-3 py-2">Question, request, cosmetic issue</td><td className="px-3 py-2">2 business days</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Business hours are 10:00&ndash;19:00 IST, Monday to Saturday, excluding Indian public holidays.
          P1 issues are accepted 24x7.
        </p>
      </>
    ),
  },
  {
    id: "suspension",
    title: "16. Suspension & Termination",
    body: (
      <>
        <p>
          We may suspend or terminate your access if you (a) breach these Terms, (b) fail to pay undisputed
          fees within 15 days of the due date, (c) use the Service in a way that risks harm to other
          customers or to the platform, or (d) are required to do so by law. We will provide reasonable
          notice except where suspension is required immediately to protect the platform.
        </p>
        <p>
          You may cancel at any time from your workspace settings. Cancellation takes effect at the end of
          the current Subscription Term.
        </p>
        <p>
          On termination for any reason: (i) we will make Customer Data available for export in CSV and
          Tally XML format for 30 days, (ii) thereafter, data may be archived in accordance with our
          retention policy, and (iii) all unpaid undisputed fees become immediately due.
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "17. Disclaimer of Warranties",
    body: (
      <p>
        Except as expressly stated in these Terms, the Service is provided on an &ldquo;as is&rdquo; and
        &ldquo;as available&rdquo; basis. To the maximum extent permitted by law, SoloBooks disclaims all
        warranties, whether express, implied or statutory, including warranties of merchantability,
        fitness for a particular purpose, and non-infringement. SoloBooks does not warrant that the
        Service will be error-free, fully secure, or that all statutory computations will be perfect for
        every fact pattern.
      </p>
    ),
  },
  {
    id: "liability",
    title: "18. Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, SoloBooks&apos; aggregate liability arising out of or in
        connection with the Service shall not exceed the fees paid by you to SoloBooks in the twelve (12)
        months immediately preceding the event giving rise to the claim. In no event shall SoloBooks be
        liable for indirect, incidental, special, consequential, or punitive damages, loss of profits,
        loss of business, loss of goodwill, or loss of data, even if advised of the possibility of such
        damages. Nothing in these Terms excludes liability that cannot be excluded under applicable law,
        including liability for fraud or gross negligence.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "19. Indemnity",
    body: (
      <p>
        You agree to indemnify, defend, and hold SoloBooks harmless from any third-party claim, demand,
        loss, or expense (including reasonable legal fees) arising from (a) Customer Data, (b) your
        breach of these Terms, (c) your violation of any law or third-party right, or (d) your misuse of
        the Service. SoloBooks will indemnify you against third-party claims that the Service, used in
        accordance with these Terms, infringes that third party&apos;s Indian patent, trademark, or
        copyright, subject to standard carve-outs (modifications by you, use with non-permitted
        third-party items, use after we offered a non-infringing replacement).
      </p>
    ),
  },
  {
    id: "confidentiality",
    title: "20. Confidentiality",
    body: (
      <p>
        Each party agrees to protect the other&apos;s confidential information using at least the same
        degree of care it uses for its own (and never less than reasonable care), to use it only to
        perform under these Terms, and to disclose it only to personnel and contractors who need to know
        and are bound by confidentiality obligations. Confidential information does not include
        information that is or becomes publicly known through no fault of the receiving party, was
        rightfully known before disclosure, or is independently developed without reference to the
        disclosing party&apos;s information.
      </p>
    ),
  },
  {
    id: "law",
    title: "21. Governing Law & Jurisdiction",
    body: (
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-laws principles.
        Subject to the dispute-resolution clause below, the courts at Bengaluru, Karnataka shall have
        exclusive jurisdiction.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "22. Dispute Resolution",
    body: (
      <p>
        Any dispute arising out of or in connection with these Terms shall first be attempted to be
        resolved by good-faith discussions between senior representatives of the parties for 30 days. If
        unresolved, the dispute shall be referred to and finally resolved by arbitration by a sole
        arbitrator under the Arbitration and Conciliation Act, 1996, seated in Bengaluru, conducted in
        English. The arbitral award shall be final and binding. Either party may seek urgent injunctive
        relief in the courts at Bengaluru pending the arbitration.
      </p>
    ),
  },
  {
    id: "force-majeure",
    title: "23. Force Majeure",
    body: (
      <p>
        Neither party is liable for failure or delay in performance (other than payment obligations)
        caused by events outside its reasonable control, including acts of God, natural disasters,
        epidemics, war, terrorism, riots, government action, internet or power outages, and failures of
        third-party infrastructure or telecom carriers. The affected party will notify the other promptly
        and use commercially reasonable efforts to resume performance.
      </p>
    ),
  },
  {
    id: "notices",
    title: "24. Notices",
    body: (
      <>
        <p>
          Notices to SoloBooks must be in writing and sent to:
        </p>
        <p className="font-mono text-[13px] leading-relaxed">
          SoloBooks Technologies Pvt. Ltd.<br />
          Attn: Legal &amp; Compliance<br />
          5th Floor, Prestige Atlanta, 80 Feet Road,<br />
          Koramangala, Bengaluru &mdash; 560034, Karnataka, India<br />
          Email: legal@solobooks.in
        </p>
        <p>
          Notices to you may be given by email to the address registered on your account or by an
          in-product notification. Notices are deemed received on the next business day after sending.
        </p>
      </>
    ),
  },
  {
    id: "assignment",
    title: "25. Assignment",
    body: (
      <p>
        You may not assign or transfer these Terms or any rights or obligations under them without our
        prior written consent. We may assign these Terms in connection with a merger, acquisition, or
        sale of all or substantially all of our assets, upon notice to you. Any prohibited assignment is
        void.
      </p>
    ),
  },
  {
    id: "miscellaneous",
    title: "26. Miscellaneous",
    body: (
      <ul>
        <li><strong>Entire agreement.</strong> These Terms, together with the Privacy Policy, the Pricing Page, and any Order, constitute the entire agreement between the parties on this subject and supersede all prior agreements.</li>
        <li><strong>Order of precedence.</strong> In case of conflict: signed Order, then these Terms, then the Privacy Policy, then the Pricing Page.</li>
        <li><strong>Severability.</strong> If any provision is held unenforceable, it will be modified to the minimum extent necessary, and the remaining provisions remain in full force.</li>
        <li><strong>Waiver.</strong> A failure to enforce a provision is not a waiver of the right to enforce it later.</li>
        <li><strong>No agency.</strong> The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, or employment relationship.</li>
        <li><strong>Survival.</strong> Sections 9, 12, 17, 18, 19, 20, 21, 22, and 26 survive termination.</li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "27. Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. Material changes will be notified by email and
        in-product at least 30 days before they take effect. Non-material changes are reflected by
        updating the &ldquo;Last updated&rdquo; date at the top of this page. Continued use of the Service
        after the effective date constitutes acceptance of the revised Terms. If you do not agree, your
        sole remedy is to cancel before the effective date and request a pro-rated refund for the unused
        portion of any pre-paid annual term.
      </p>
    ),
  },
  {
    id: "contact",
    title: "28. Contact",
    body: (
      <p className="font-mono text-[13px] leading-relaxed">
        SoloBooks Technologies Pvt. Ltd.<br />
        5th Floor, Prestige Atlanta, 80 Feet Road,<br />
        Koramangala, Bengaluru &mdash; 560034, Karnataka, India<br />
        CIN: U72900KA2024PTC178945<br />
        Email: legal@solobooks.in &middot; Support: support@solobooks.in
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
