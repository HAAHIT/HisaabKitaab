import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Export Data from HisaabKitaab to TallyPrime | Guide",
  description: "Learn how to effortlessly sync your daily billing and purchase data generated in HisaabKitaab back into TallyPrime for your CA.",
};

export default function ExportToTallyGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Export Data from HisaabKitaab to TallyPrime",
    description:
      "Syncing daily billing/purchases generated in our SaaS software back into Tally for the user's CA.",
    step: [
      {
        "@type": "HowToStep",
        name: "Generate the Export",
        text: "Go to Reports > Tally Export. Select your desired date range (e.g., this month) and click Generate XML.",
      },
      {
        "@type": "HowToStep",
        name: "Send to CA",
        text: "Download the generated TallyExport.xml file and securely share it with your CA via email or direct link.",
      },
      {
        "@type": "HowToStep",
        name: "Import into Tally",
        text: "Your CA can simply go to Import > Transactions in TallyPrime, specify the path to your file, and import all vouchers instantly without duplication.",
      },
    ],
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-white py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />

      <article className="relative max-w-4xl mx-auto bg-white/70 backdrop-blur-md border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-8 sm:p-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            How to Export Data from HisaabKitaab to{" "}
            <span className="text-teal-600">TallyPrime</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            A comprehensive guide to syncing daily billing and purchases
            generated in our software back into Tally for your CA.
          </p>
        </header>

        <div className="prose prose-slate prose-teal max-w-none prose-headings:font-semibold prose-a:text-teal-600 hover:prose-a:text-teal-500 prose-p:leading-relaxed">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 mt-8">
            Seamless CA Collaboration
          </h2>
          <p className="text-slate-600 mb-8">
            Your business runs on the cloud, but your Chartered Accountant
            likely still relies on TallyPrime. HisaabKitaab bridges this gap by
            generating standard Tally XML files that can be directly imported
            into Tally without any manual data entry.
          </p>

          <h2 className="text-2xl font-bold text-slate-800 mb-4 mt-12">
            Understanding the XML Structure
          </h2>
          <p className="text-slate-600 mb-8">
            To ensuring error-free synchronization, HisaabKitaab meticulously
            constructs the XML payload to adhere to strict Tally standards.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
            <div className="bg-white/60 p-6 rounded-2xl border border-blue-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-lg text-blue-800 mt-0 font-bold font-mono bg-blue-50/50 inline-block px-3 py-1 rounded-md mb-4 border border-blue-100">
                &lt;TALLYMESSAGE&gt;
              </h3>
              <p className="text-sm text-slate-600 mb-0">
                Each voucher is wrapped in its own{" "}
                <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded">
                  &lt;TALLYMESSAGE&gt;
                </code>{" "}
                envelope. We ensure atomic transaction integrity by maintaining
                precise references to Ledgers, ensuring debit and credit totals
                match perfectly.
              </p>
            </div>
            <div className="bg-white/60 p-6 rounded-2xl border border-teal-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-lg text-teal-800 mt-0 font-bold font-mono bg-teal-50/50 inline-block px-3 py-1 rounded-md mb-4 border border-teal-100">
                &lt;GSTDETAILS.LIST&gt;
              </h3>
              <p className="text-sm text-slate-600 mb-0">
                GST compliance is crucial. Our exports accurately build the{" "}
                <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded">
                  &lt;GSTDETAILS.LIST&gt;
                </code>{" "}
                node, capturing precise taxable values, CGST, SGST, IGST splits,
                and tracking intra vs inter-state transactions.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-6 mt-12">
            Step-by-Step Export Process
          </h2>

          <div className="space-y-8 mt-8">
            <div className="flex gap-5 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl group-hover:bg-teal-100 group-hover:scale-110 transition-all shadow-sm">
                1
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mt-2 mb-2">
                  Generate the Export
                </h3>
                <p className="text-slate-600 mb-0">
                  Go to <strong>Reports &gt; Tally Export</strong>. Select your
                  desired date range (e.g., this month) and click{" "}
                  <strong>Generate XML</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-5 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl group-hover:bg-teal-100 group-hover:scale-110 transition-all shadow-sm">
                2
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mt-2 mb-2">
                  Send to CA
                </h3>
                <p className="text-slate-600 mb-0">
                  Download the generated{" "}
                  <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-sm">
                    TallyExport.xml
                  </code>{" "}
                  file and securely share it with your CA via email or direct
                  link.
                </p>
              </div>
            </div>

            <div className="flex gap-5 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl group-hover:bg-teal-100 group-hover:scale-110 transition-all shadow-sm">
                3
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mt-2 mb-2">
                  Import into Tally
                </h3>
                <p className="text-slate-600 mb-0">
                  Your CA can simply go to{" "}
                  <strong>Import &gt; Transactions</strong> in TallyPrime,
                  specify the path to your file, and import all vouchers
                  instantly without duplication.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center pt-8 border-t border-gray-100">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-full text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            Go to Dashboard
          </Link>
        </div>
      </article>
    </div>
  );
}
