export function Footer() {
  const cols = [
    {
      title: "Product",
      links: ["Fast billing", "Udhar Khata", "Tally export", "Tally import", "Bank reconciliation", "Purchase OCR", "GST returns"],
    },
    {
      title: "For CAs",
      links: ["CA portal", "Tally compatibility", "GSTR-1 / 3B", "Quarterly handoff", "Bulk import"],
    },
    {
      title: "Company",
      links: ["About", "Pricing", "Careers", "Blog", "Press kit", "Contact"],
    },
    {
      title: "Resources",
      links: ["Hindi guide", "How-to videos", "WhatsApp helpline", "Status", "Changelog"],
    },
  ];

  return (
    <footer className="relative border-t border-slate-200/60 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-16 pb-10">
        <div className="grid md:grid-cols-[1.4fr_repeat(4,1fr)] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 19V8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 13h6"/></svg>
              </span>
              <span className="font-display text-[20px] font-semibold text-slate-900">SoloBooks</span>
            </div>
            <p className="mt-4 text-[13.5px] text-slate-500 max-w-[280px] leading-relaxed">
              Bookkeeping for the way India does business. Built in Bengaluru. Loved in 280 cities.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {["X", "in", "Yt", "Ig"].map((s) => (
                <a key={s} href="#" className="h-9 w-9 grid place-items-center rounded-full ring-1 ring-slate-200 text-slate-400 hover:text-slate-700 hover:bg-white text-[11px] font-medium">
                  {s}
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-mono">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-[13px] text-slate-500 hover:text-slate-900">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-slate-400">
          <p>© 2026 SoloBooks Technologies Pvt. Ltd. · Made for Bharat.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-slate-700">Terms</a>
            <a href="#" className="hover:text-slate-700">Privacy</a>
            <a href="#" className="hover:text-slate-700">Refund policy</a>
            <span className="font-mono">v3.2</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
