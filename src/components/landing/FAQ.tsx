export type FaqItem = { q: string; a: string };

type Props = {
  items: FaqItem[];
  heading?: string;
  eyebrow?: string;
  /** Render the FAQPage JSON-LD. Disable on pages that already emit it elsewhere. */
  schema?: boolean;
};

/**
 * Crawlable FAQ section. Uses native <details>/<summary> so the answer text is
 * present in the server-rendered HTML (no JS required) and emits FAQPage
 * structured data. Visible answer text is kept identical to the schema text so
 * generative engines and search engines see a consistent source.
 */
export function FAQ({
  items,
  heading = "Frequently asked questions",
  eyebrow = "FAQ",
  schema = true,
}: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center mb-10">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-medium text-blue-700 ring-1 ring-blue-200">
              {eyebrow}
            </span>
          )}
          <h2 className="mt-4 font-display text-[32px] sm:text-[44px] font-medium leading-[1.05] tracking-tight text-slate-900">
            {heading}
          </h2>
        </div>

        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {items.map((it, i) => (
            <details key={i} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] sm:text-[17px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {it.q}
                <svg
                  className="flex-shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="pb-5 -mt-1 text-[15px] text-slate-600 leading-relaxed">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
