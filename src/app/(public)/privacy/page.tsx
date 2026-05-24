import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How SoloBooks collects, uses, and protects information from Indian businesses using our billing, Udhar Khata, and Tally-compatible accounting platform.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "May 24, 2026";

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    body: (
      <>
        <p>
          SoloBooks (operated by SoloBooks Technologies Pvt. Ltd., &ldquo;SoloBooks&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;,
          &ldquo;us&rdquo;) provides a cloud bookkeeping, billing, and GST accounting platform purpose-built
          for businesses operating in India. This Privacy Policy explains what information we collect when
          you use our website, mobile apps, and APIs (collectively, the &ldquo;Service&rdquo;), how we use it,
          how long we keep it, with whom we share it, and the choices you have.
        </p>
        <p>
          This policy is published in accordance with the Information Technology Act, 2000, the Information
          Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information)
          Rules, 2011 (the &ldquo;SPDI Rules&rdquo;), and the Digital Personal Data Protection Act, 2023
          (the &ldquo;DPDP Act&rdquo;).
        </p>
        <p>
          For the purposes of the DPDP Act, SoloBooks is the &ldquo;Data Fiduciary&rdquo; in respect of the
          personal data of account owners, invited users, and individuals you record in your books (the
          &ldquo;Data Principals&rdquo;). Where you record personal data about your customers, employees, or
          vendors in the Service, you act as the Data Fiduciary for that data and SoloBooks acts as a
          &ldquo;Data Processor&rdquo; on your behalf.
        </p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "2. Definitions",
    body: (
      <>
        <ul>
          <li><strong>Customer Data</strong> &mdash; books, vouchers, parties, items, payments, journal entries, and any other data you upload, enter, or generate in the Service.</li>
          <li><strong>Personal Data</strong> &mdash; data about an identified or identifiable individual.</li>
          <li><strong>Sensitive Personal Data or Information (SPDI)</strong> &mdash; as defined in the SPDI Rules: passwords, financial information such as bank details, and any other category covered by the Rules.</li>
          <li><strong>Sub-processor</strong> &mdash; a third party engaged by SoloBooks to process Customer Data or Personal Data on our behalf.</li>
          <li><strong>Tenant</strong> &mdash; your isolated workspace inside SoloBooks, identified by a unique tenant ID.</li>
        </ul>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "3. Information We Collect",
    body: (
      <>
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address, mobile number, business name, GSTIN,
            PAN, billing address, login credentials (passwords are stored hashed using bcrypt &mdash; never in
            plain text), and role assignments.
          </li>
          <li>
            <strong>Business records you enter or upload:</strong> sales bills, purchase invoices, party
            (customer and vendor) details including their contact information and GSTIN, item catalogues,
            payment receipts, bank statements, attachments, and journal entries.
          </li>
          <li>
            <strong>Tally import / export data:</strong> XML voucher data exchanged between SoloBooks and
            your Tally ERP 9 or Tally Prime instance.
          </li>
          <li>
            <strong>Payment information:</strong> billing address and limited card / UPI metadata returned
            by our payment gateway. Full card numbers, CVV, and bank credentials never touch SoloBooks
            servers &mdash; they are collected directly by the payment processor.
          </li>
          <li>
            <strong>Usage and device data:</strong> IP address, browser type, operating system, device
            identifiers, pages viewed, feature interactions, request IDs, and timestamps.
          </li>
          <li>
            <strong>Communications:</strong> support messages, WhatsApp helpline conversations, screen
            recordings you voluntarily share, and feedback you send us.
          </li>
        </ul>
        <p>
          We do not knowingly collect biometric data, location coordinates, or special categories of
          sensitive data beyond what is described above.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "4. How We Use Information",
    body: (
      <ul>
        <li>To provide, operate, and maintain the Service, including billing, Udhar Khata, GST returns, bank reconciliation, and Tally compatibility.</li>
        <li>To authenticate users, enforce tenant isolation, and prevent unauthorised access to your books.</li>
        <li>To generate journal entries, party balances, and statutory reports in accordance with Indian double-entry accounting standards.</li>
        <li>To process payments for your subscription and issue tax invoices.</li>
        <li>To respond to support requests and send service-related notifications.</li>
        <li>To improve product performance, detect abuse, debug issues, and ensure platform integrity.</li>
        <li>To comply with applicable law, including responding to lawful requests from public authorities.</li>
      </ul>
    ),
  },
  {
    id: "legal-basis",
    title: "5. Legal Basis for Processing",
    body: (
      <p>
        We process personal data on the following bases: (a) your consent at sign-up and at the point of
        collecting specific data; (b) the performance of our contract with you (these Terms of Use and your
        order); (c) our legitimate interests in operating, securing, and improving the Service, balanced
        against your rights; and (d) compliance with our legal obligations under Indian tax, accounting, and
        anti-fraud law.
      </p>
    ),
  },
  {
    id: "tenant-isolation",
    title: "6. Tenant Isolation & Data Separation",
    body: (
      <p>
        SoloBooks is a multi-tenant platform. Every record carries a tenant identifier and access is
        verified on each request against a signed JSON Web Token. Application-level scoping ensures one
        tenant cannot read or modify another tenant&apos;s data. Internal staff access is limited to named
        engineers, requires multi-factor authentication, is audit-logged, and is used only to provide
        support, investigate incidents, or comply with law.
      </p>
    ),
  },
  {
    id: "sub-processors",
    title: "7. Sub-processors",
    body: (
      <>
        <p>
          We engage the following categories of sub-processors. Each is contractually bound by
          confidentiality, data-protection, and security obligations consistent with the SPDI Rules and the
          DPDP Act. We may update this list from time to time; material changes will be notified at least
          30 days in advance.
        </p>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-mono">
                <th className="px-3 py-2 border-b border-slate-200">Sub-processor</th>
                <th className="px-3 py-2 border-b border-slate-200">Purpose</th>
                <th className="px-3 py-2 border-b border-slate-200">Region</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr><td className="px-3 py-2 border-b border-slate-100">Supabase Inc.</td><td className="px-3 py-2 border-b border-slate-100">Managed PostgreSQL hosting &amp; storage</td><td className="px-3 py-2 border-b border-slate-100">Mumbai (ap-south-1) / Singapore (ap-southeast-1)</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Amazon Web Services</td><td className="px-3 py-2 border-b border-slate-100">Underlying compute &amp; storage infrastructure</td><td className="px-3 py-2 border-b border-slate-100">Mumbai (ap-south-1)</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Vercel Inc.</td><td className="px-3 py-2 border-b border-slate-100">Edge hosting &amp; CDN for the web application</td><td className="px-3 py-2 border-b border-slate-100">Global edge; primary compute in Mumbai</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Razorpay Software Pvt. Ltd.</td><td className="px-3 py-2 border-b border-slate-100">Subscription payments &amp; UPI / card processing</td><td className="px-3 py-2 border-b border-slate-100">India</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Stripe Payments India Pvt. Ltd.</td><td className="px-3 py-2 border-b border-slate-100">International card payments (where applicable)</td><td className="px-3 py-2 border-b border-slate-100">India / United States</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">AiSensy / Gupshup (WhatsApp BSP)</td><td className="px-3 py-2 border-b border-slate-100">WhatsApp Business helpline &amp; bill delivery</td><td className="px-3 py-2 border-b border-slate-100">India</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Amazon SES / Resend</td><td className="px-3 py-2 border-b border-slate-100">Transactional email delivery</td><td className="px-3 py-2 border-b border-slate-100">Mumbai / United States</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Google Cloud Vision / AWS Textract</td><td className="px-3 py-2 border-b border-slate-100">OCR for purchase-invoice scanning (only when used)</td><td className="px-3 py-2 border-b border-slate-100">Mumbai / Singapore</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Sentry / Better Stack</td><td className="px-3 py-2 border-b border-slate-100">Error monitoring &amp; observability</td><td className="px-3 py-2 border-b border-slate-100">European Union / United States</td></tr>
              <tr><td className="px-3 py-2">PostHog</td><td className="px-3 py-2">Product analytics (with IP anonymisation)</td><td className="px-3 py-2">European Union</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-slate-500 mt-3">
          The current authoritative list of sub-processors is published at
          <span className="font-mono"> solobooks.in/legal/sub-processors</span>.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "8. How We Share Information",
    body: (
      <>
        <p>We do not sell your data. We share information only as follows:</p>
        <ul>
          <li>
            <strong>Sub-processors</strong> listed in Section 7, strictly to deliver the Service.
          </li>
          <li>
            <strong>Your CA or staff:</strong> only the users you explicitly invite to your workspace, with
            the role you assign (Admin, Accountant, Salesperson, Viewer).
          </li>
          <li>
            <strong>Statutory authorities:</strong> when required by Indian law, court order, or to defend
            our legal rights, subject to the safeguards in Section 16.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of
            assets, subject to equivalent protections and at least 30 days&apos; prior notice.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "data-location",
    title: "9. Data Storage, Location & Cross-Border Transfer",
    body: (
      <>
        <p>
          Your data is hosted on infrastructure located primarily in India (Mumbai region). Limited
          categories of data may be processed outside India by sub-processors listed in Section 7
          (for example, error telemetry by Sentry, or international card payments). Such transfers are
          made only:
        </p>
        <ul>
          <li>to jurisdictions that are not restricted by the Central Government under section 16 of the DPDP Act; and</li>
          <li>under contractual safeguards equivalent to the protections in this policy.</li>
        </ul>
        <p>
          Backups are encrypted at rest using AES-256 and replicated within the same region. Tally export
          files are generated on-demand and not retained on our servers after download.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "10. Data Retention",
    body: (
      <>
        <p>
          Because your books are statutory records, retention periods differ by data type:
        </p>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-mono">
                <th className="px-3 py-2 border-b border-slate-200">Data Type</th>
                <th className="px-3 py-2 border-b border-slate-200">Retention Period</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr><td className="px-3 py-2 border-b border-slate-100">Bills, purchases, journal entries, party ledgers</td><td className="px-3 py-2 border-b border-slate-100">For the life of your account + 8 years (Income Tax Act, 1961 and CGST Act, 2017)</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Account profile &amp; login credentials</td><td className="px-3 py-2 border-b border-slate-100">Until 90 days after account closure</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Payment / invoice records</td><td className="px-3 py-2 border-b border-slate-100">8 years from the date of the transaction</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Support communications</td><td className="px-3 py-2 border-b border-slate-100">3 years</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Application &amp; security audit logs</td><td className="px-3 py-2 border-b border-slate-100">2 years</td></tr>
              <tr><td className="px-3 py-2 border-b border-slate-100">Product analytics (anonymised)</td><td className="px-3 py-2 border-b border-slate-100">25 months</td></tr>
              <tr><td className="px-3 py-2">Encrypted off-site backups</td><td className="px-3 py-2">35 days rolling</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          You may request an export of your books in CSV or Tally XML format at any time. Soft-deleted
          records are preserved for accounting integrity and are not hard-deleted before the statutory
          retention period expires.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "11. Security",
    body: (
      <>
        <p>We apply industry-standard safeguards, including:</p>
        <ul>
          <li>TLS 1.2+ encryption in transit; AES-256 encryption at rest for primary stores and backups.</li>
          <li>Bcrypt password hashing with per-record salts.</li>
          <li>Role-based access control with strict tenant scoping on every query.</li>
          <li>Per-tenant advisory locks on critical sequences (such as bill numbering).</li>
          <li>Rate limiting, audit logging, and structured observability on sensitive mutations.</li>
          <li>Multi-factor authentication for SoloBooks staff with production access.</li>
          <li>Quarterly internal security reviews and periodic third-party penetration testing.</li>
        </ul>
        <p>
          No system is perfectly secure. You are responsible for keeping your login credentials confidential,
          enabling multi-factor authentication where offered, and notifying us promptly if you suspect
          unauthorised access.
        </p>
      </>
    ),
  },
  {
    id: "breach-notification",
    title: "12. Personal Data Breach Notification",
    body: (
      <p>
        If we become aware of a personal data breach affecting your information, we will notify the Data
        Protection Board of India and affected users without undue delay, and in any case within 72 hours
        of becoming aware of the breach, as required by the DPDP Act and the Cert-In Directions, 2022.
        Notifications will describe the nature of the breach, the categories of data affected, the likely
        consequences, the mitigation measures taken, and a contact point for further information.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "13. Your Rights",
    body: (
      <>
        <p>Subject to applicable law, you may:</p>
        <ul>
          <li>Access and review your personal data in your account settings or by request.</li>
          <li>Correct, complete, or update inaccurate or incomplete data.</li>
          <li>Erase personal data where it is no longer necessary for the purpose collected, subject to statutory retention obligations.</li>
          <li>Export your books in CSV or Tally XML format at any time.</li>
          <li>Withdraw consent for any optional processing &mdash; without affecting the lawfulness of prior processing.</li>
          <li>Nominate a person to exercise your rights in the event of your death or incapacity, as provided under section 14 of the DPDP Act.</li>
          <li>Lodge a grievance with our Grievance Officer (Section 19) and, if unresolved, with the Data Protection Board of India.</li>
        </ul>
        <p>
          We will respond to verifiable rights requests within 30 days. We may decline requests that are
          manifestly unfounded, excessive, or that would prejudice the rights of others.
        </p>
      </>
    ),
  },
  {
    id: "consent-manager",
    title: "14. Consent & Consent Managers",
    body: (
      <p>
        Where the DPDP Act requires consent, we obtain it through a clear affirmative action at the point
        of collection, in plain language, and in your chosen language where supported (English, Hindi).
        Once the Central Government notifies and registers Consent Managers under section 6(7) of the
        DPDP Act, you will be able to manage, review, and withdraw your consents through a registered
        Consent Manager linked to your SoloBooks account.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "15. Cookies & Similar Technologies",
    body: (
      <>
        <p>We use the following categories of cookies and local-storage entries:</p>
        <ul>
          <li><strong>Strictly necessary:</strong> session cookie, CSRF token, tenant selector, language preference. These cannot be disabled.</li>
          <li><strong>Functional:</strong> remembered email, recent workspace, UI theme.</li>
          <li><strong>Analytics:</strong> anonymised page and feature usage via PostHog, with IP truncation enabled. You may opt out from your account settings.</li>
        </ul>
        <p>
          We do not use advertising or cross-site tracking cookies. Disabling strictly necessary cookies
          will impair core functionality such as login.
        </p>
      </>
    ),
  },
  {
    id: "lawful-requests",
    title: "16. Law Enforcement & Government Requests",
    body: (
      <p>
        We disclose Customer Data to government authorities only when compelled by a valid legal demand
        (a written order, notice, or subpoena issued under Indian law). We review each request, push back
        on requests that are overbroad or improperly served, narrow the disclosure to the data strictly
        required, and notify the affected customer unless prohibited by law. Where permitted, we publish
        annual aggregate transparency statistics on government requests received.
      </p>
    ),
  },
  {
    id: "children",
    title: "17. Children",
    body: (
      <p>
        SoloBooks is intended for business use and is not directed at individuals under 18. We do not
        knowingly collect personal data from children. If we learn that we have collected personal data
        from a child, we will delete it promptly. Where you process personal data of children in your
        books (for example, a customer&apos;s dependant&apos;s name), you are responsible for obtaining
        verifiable parental consent in accordance with section 9 of the DPDP Act.
      </p>
    ),
  },
  {
    id: "changes",
    title: "18. Changes to this Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. Material changes (such as new sub-processor
        categories, new retention periods, or expanded data collection) will be notified to you by email
        and through an in-product notice at least 30 days before they take effect. Non-material changes
        will be reflected by updating the &ldquo;Last updated&rdquo; date at the top of this page.
      </p>
    ),
  },
  {
    id: "contact",
    title: "19. Contact & Grievance Officer",
    body: (
      <>
        <p>
          In accordance with the Information Technology Act, 2000, the SPDI Rules, and the DPDP Act, the
          following individual is designated as our Grievance Officer:
        </p>
        <p className="font-mono text-[13px] leading-relaxed">
          Name: Aditya Sharma<br />
          Designation: Grievance Officer &amp; Data Protection Officer<br />
          SoloBooks Technologies Pvt. Ltd.<br />
          5th Floor, Prestige Atlanta, 80 Feet Road,<br />
          Koramangala, Bengaluru &mdash; 560034, Karnataka, India<br />
          Email: grievance@solobooks.in<br />
          Phone: +91-80-4567-8900 (Mon&ndash;Fri, 10:00&ndash;18:00 IST)
        </p>
        <p>
          We will acknowledge grievances within 48 hours and aim to resolve them within 15 days. For
          general privacy queries, you may write to <span className="font-mono">privacy@solobooks.in</span>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="solobooks-landing legal-page min-h-screen relative bg-white">
      <Nav />

      <section className="relative pt-32 pb-16 px-5 sm:px-8">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="divider-tick">Legal &middot; Privacy</span>
          <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.05] text-slate-900 mt-5">
            Privacy Policy
          </h1>
          <p className="mt-5 text-[15px] text-slate-500 max-w-xl mx-auto leading-relaxed">
            How SoloBooks collects, uses, and protects the information you and your business entrust to us.
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
