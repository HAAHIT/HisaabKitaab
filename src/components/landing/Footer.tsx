export function Footer() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Guides",
      links: [
        { label: "All guides", href: "/guides" },
        { label: "Tally export", href: "/guides/export-to-tally" },
        { label: "Tally import", href: "/guides/import-from-tally" },
        { label: "GSTR-1 & GSTR-3B", href: "/guides/gst-filing" },
      ],
    },
    {
      title: "Product",
      links: [
        { label: "Sign in", href: "/login" },
        { label: "Create account", href: "/register" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
        { label: "Refund policy", href: "/terms#refunds" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-slate-200/60 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-16 pb-10">
        <div className="grid md:grid-cols-[1.6fr_repeat(3,1fr)] gap-10">
          <div>
            <a href="/" className="flex items-center gap-2.5">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 19V8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 13h6"/></svg>
              </span>
              <span className="font-display text-[20px] font-semibold text-slate-900">SoloBooks</span>
            </a>
            <p className="mt-4 text-[13.5px] text-slate-500 max-w-[280px] leading-relaxed">
              Bookkeeping for the way India does business. Built for Bharat.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-mono">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[13px] text-slate-500 hover:text-slate-900">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-slate-400">
          <p>© 2026 SoloBooks Technologies Pvt. Ltd. · Made for Bharat.</p>
          <div className="flex items-center gap-5">
            <a href="/terms" className="hover:text-slate-700">Terms</a>
            <a href="/privacy" className="hover:text-slate-700">Privacy</a>
            <a href="/terms#refunds" className="hover:text-slate-700">Refund policy</a>
            <span className="font-mono">v3.2</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
