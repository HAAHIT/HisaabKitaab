import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Import Data from TallyPrime into SoloBooks | Guide",
  description: "Learn step-by-step how to migrate existing ledgers, parties, and historical vouchers out of TallyPrime cleanly and seamlessly into SoloBooks.",
};

export default function ImportFromTallyGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Import Data from TallyPrime into SoloBooks",
    description:
      "Migrate your existing ledgers, parties, and historical vouchers out of Tally and into our cloud platform.",
    step: [
      {
        "@type": "HowToStep",
        name: "Export Masters from Tally",
        text: "Open TallyPrime and navigate to Export > Masters. Ensure the export format is set to XML (Data Interchange). This will generate a Master.xml file.",
      },
      {
        "@type": "HowToStep",
        name: "Export Vouchers (Historical Data)",
        text: "Navigate to Export > Transactions or a specific Day Book/Register. Select the date range and export as XML (Data Interchange). This will give you DayBook.xml.",
      },
      {
        "@type": "HowToStep",
        name: "Upload to SoloBooks",
        text: "Log into your SoloBooks dashboard. Navigate to Settings > Data Management > Import from Tally. Upload the Master.xml first, followed by the DayBook.xml.",
      },
      {
        "@type": "HowToStep",
        name: "Verify and Confirm",
        text: "Once the parsing is complete, review the summary of imported ledgers and vouchers. Click Confirm Import to permanently write these records into your cloud database.",
      },
    ],
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-white py-16 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Background decorations for glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-200/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] bg-indigo-200/40 rounded-full blur-[100px] pointer-events-none" />

      <article className="relative max-w-4xl mx-auto bg-white/70 backdrop-blur-md border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-8 sm:p-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            How to Import Data from{" "}
            <span className="text-teal-600">TallyPrime</span> into SoloBooks
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            A comprehensive guide to migrating your existing ledgers, parties,
            and historical vouchers out of Tally and into our cloud platform.
          </p>
        </header>

        <div className="prose prose-slate prose-teal max-w-none prose-headings:font-semibold prose-a:text-teal-600 hover:prose-a:text-teal-500 prose-p:leading-relaxed">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 mt-8">
            Why Migrate to SoloBooks?
          </h2>
          <p className="text-slate-600 mb-8">
            Moving from traditional desktop software like TallyPrime to a modern
            cloud-based solution like SoloBooks gives you real-time access to
            your financial data, anywhere, anytime. Our system is designed
            specifically for Indian MSMEs to streamline their workflow.
          </p>

          <h2 className="text-2xl font-bold text-slate-800 mb-6 mt-12">
            Step-by-Step Import Process
          </h2>

          <div className="space-y-6 mt-8">
            <section className="bg-white/50 rounded-2xl p-6 md:p-8 border border-teal-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-xl font-bold text-teal-800 mt-0 mb-3 flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  1
                </span>
                Step 1: Export Masters from Tally
              </h3>
              <p className="text-slate-600 mb-0 pl-11">
                Open TallyPrime and navigate to <strong>Export &gt; Masters</strong>
                . Ensure the export format is set to{" "}
                <strong>XML (Data Interchange)</strong>. This will generate a{" "}
                <code className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-sm whitespace-nowrap">
                  Master.xml
                </code>{" "}
                file containing all your Ledgers, Stock Items, and Party details.
              </p>
            </section>

            <section className="bg-white/50 rounded-2xl p-6 md:p-8 border border-teal-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-xl font-bold text-teal-800 mt-0 mb-3 flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  2
                </span>
                Step 2: Export Vouchers (Historical Data)
              </h3>
              <p className="text-slate-600 mb-0 pl-11">
                Similarly, navigate to{" "}
                <strong>Export &gt; Transactions</strong> or a specific Day
                Book/Register. Select the date range you wish to migrate and
                export as <strong>XML (Data Interchange)</strong>. This will give
                you{" "}
                <code className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-sm whitespace-nowrap">
                  DayBook.xml
                </code>{" "}
                containing your historical vouchers.
              </p>
            </section>

            <section className="bg-white/50 rounded-2xl p-6 md:p-8 border border-teal-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-xl font-bold text-teal-800 mt-0 mb-3 flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  3
                </span>
                Step 3: Upload to SoloBooks
              </h3>
              <p className="text-slate-600 mb-0 pl-11">
                Log into your SoloBooks dashboard. Navigate to{" "}
                <strong>Settings &gt; Data Management &gt; Import from Tally</strong>
                . Upload the{" "}
                <code className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-sm whitespace-nowrap">
                  Master.xml
                </code>{" "}
                first, followed by the{" "}
                <code className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-sm whitespace-nowrap">
                  DayBook.xml
                </code>
                . Our intelligent parser will automatically handle structural
                mappings, balance validations, and GST compliance checks.
              </p>
            </section>

            <section className="bg-white/50 rounded-2xl p-6 md:p-8 border border-teal-50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md">
              <h3 className="text-xl font-bold text-teal-800 mt-0 mb-3 flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  4
                </span>
                Step 4: Verify and Confirm
              </h3>
              <p className="text-slate-600 mb-0 pl-11">
                Once the parsing is complete, review the summary of imported
                ledgers and vouchers. Click <strong>Confirm Import</strong> to
                permanently write these records into your cloud database. Your
                trial balances should perfectly match!
              </p>
            </section>
          </div>
        </div>

        <div className="mt-12 text-center pt-8 border-t border-gray-100">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-full text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            Go to Dashboard
          </Link>
          <p className="mt-8 text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto">
            *Tally and TallyPrime are registered trademarks of Tally Solutions Pvt. Ltd. <br />
            SoloBooks is an independent product and is not affiliated with, endorsed by, or sponsored by Tally Solutions.
          </p>
        </div>
      </article>
    </div>
  );
}
