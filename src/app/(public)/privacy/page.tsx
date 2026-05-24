import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | SoloBooks",
  description:
    "How SoloBooks collects, uses, and protects information from Indian businesses using our billing, Udhar Khata, and Tally-compatible accounting platform.",
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
          and the choices you have.
        </p>
        <p>
          This policy is published in accordance with the Information Technology Act, 2000, the Information
          Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information)
          Rules, 2011, and the Digital Personal Data Protection Act, 2023.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    body: (
      <>
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address, mobile number, business name, GSTIN,
            PAN, billing address, and login credentials.
          </li>
          <li>
            <strong>Business records you enter or upload:</strong> bills, purchase invoices, party (customer
            and vendor) details, item catalogues, payment receipts, bank statements, and journal entries.
          </li>
          <li>
            <strong>Tally import / export data:</strong> XML voucher data exchanged between SoloBooks and
            your Tally ERP 9 or Tally Prime instance.
          </li>
          <li>
            <strong>Usage and device data:</strong> IP address, browser type, operating system, device
            identifiers, pages viewed, feature interactions, and timestamps.
          </li>
          <li>
            <strong>Communications:</strong> support messages, WhatsApp helpline conversations, and feedback
            you send us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How We Use Information",
    body: (
      <>
        <ul>
          <li>To provide, operate, and maintain the Service, including billing, Udhar Khata, GST returns, and Tally compatibility.</li>
          <li>To authenticate users, enforce tenant isolation, and prevent unauthorised access to your books.</li>
          <li>To generate journal entries, party balances, and statutory reports in accordance with Indian double-entry accounting standards.</li>
          <li>To process payments for your subscription and issue tax invoices.</li>
          <li>To respond to support requests and send service-related notifications.</li>
          <li>To improve product performance, detect abuse, and comply with applicable law.</li>
        </ul>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "4. Legal Basis for Processing",
    body: (
      <p>
        We process personal data on the basis of your consent at sign-up, the performance of our contract
        with you, our legitimate interests in operating and securing the Service, and to comply with our
        legal obligations under Indian tax and accounting law.
      </p>
    ),
  },
  {
    id: "tenant-isolation",
    title: "5. Tenant Isolation & Data Separation",
    body: (
      <p>
        SoloBooks is a multi-tenant platform. Every record is scoped to your tenant identifier and access is
        verified on each request against a signed session token. Your books are not visible to any other
        SoloBooks customer. Internal staff access is limited, audit-logged, and used only to provide support
        or comply with law.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "6. How We Share Information",
    body: (
      <>
        <p>We do not sell your data. We share information only as follows:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> hosting (Supabase / PostgreSQL), email delivery, payment
            gateways, and analytics &mdash; each bound by confidentiality and data-processing terms.
          </li>
          <li>
            <strong>Your Chartered Accountant or staff:</strong> only the users you explicitly invite to your
            workspace, with the role you assign.
          </li>
          <li>
            <strong>Statutory authorities:</strong> when required by Indian law, court order, or to defend our
            legal rights.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets,
            subject to equivalent protections.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "data-location",
    title: "7. Data Storage & Location",
    body: (
      <p>
        Your data is stored on servers operated by our cloud infrastructure providers, primarily in India and
        in regions that meet our security standards. Backups are encrypted at rest. Tally export files you
        generate are produced on-demand and not retained on our servers after delivery unless you choose to
        store them in your workspace.
      </p>
    ),
  },
  {
    id: "retention",
    title: "8. Data Retention",
    body: (
      <p>
        Because your books are statutory records, SoloBooks retains your billing, accounting, and journal
        data for as long as your account is active and for at least eight (8) years thereafter, in line with
        the retention requirements under the Income Tax Act, 1961 and the CGST Act, 2017. You may request
        an export at any time. Soft-deleted records are preserved in line with our accounting integrity
        rules; they are not hard-deleted.
      </p>
    ),
  },
  {
    id: "security",
    title: "9. Security",
    body: (
      <>
        <p>We apply industry-standard safeguards, including:</p>
        <ul>
          <li>TLS encryption in transit and encryption at rest for primary stores.</li>
          <li>Role-based access control with strict tenant scoping on every query.</li>
          <li>Rate limiting, advisory locking, and audit logging on sensitive mutations.</li>
          <li>Regular dependency, security, and penetration reviews.</li>
        </ul>
        <p>
          No system is perfectly secure. You are responsible for keeping your login credentials confidential
          and notifying us promptly if you suspect unauthorised access.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "10. Your Rights",
    body: (
      <>
        <p>Subject to applicable law, you may:</p>
        <ul>
          <li>Access and review your personal data in your account settings.</li>
          <li>Correct inaccurate data directly or by writing to us.</li>
          <li>Export your books in CSV or Tally XML format at any time.</li>
          <li>Withdraw consent or close your account &mdash; subject to statutory retention obligations.</li>
          <li>Nominate a person to exercise your rights in the event of incapacity, per the DPDP Act, 2023.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "11. Cookies & Similar Technologies",
    body: (
      <p>
        We use strictly necessary cookies to keep you signed in and to remember your workspace, plus
        limited analytics cookies to understand how the Service is used. You can control cookies through
        your browser settings; disabling essential cookies will impair core functionality.
      </p>
    ),
  },
  {
    id: "children",
    title: "12. Children",
    body: (
      <p>
        SoloBooks is intended for business use and is not directed at individuals under 18. We do not
        knowingly collect personal data from children.
      </p>
    ),
  },
  {
    id: "changes",
    title: "13. Changes to this Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. Material changes will be notified to you by
        email or through an in-product notice at least 7 days before they take effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "14. Contact & Grievance Officer",
    body: (
      <>
        <p>
          For any questions about this policy or to exercise your rights, contact our Grievance Officer:
        </p>
        <p className="font-mono text-[13px] leading-relaxed">
          Grievance Officer<br />
          SoloBooks Technologies Pvt. Ltd.<br />
          Email: privacy@solobooks.in
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
