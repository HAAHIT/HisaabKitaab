"use client";
import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#fast-billing", label: "Billing" },
    { href: "#udhar", label: "Udhar Khata" },
    { href: "#tally", label: "Tally" },
    { href: "#more", label: "More" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled ? "backdrop-blur-xl bg-white/80 border-b border-slate-200/60 shadow-sm" : "bg-transparent"
    }`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 group">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 19V8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 13h6"/></svg>
          </span>
          <span className="font-display text-[19px] font-semibold tracking-tight text-slate-900">SoloBooks</span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-[13.5px] text-slate-600">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="px-3 py-2 rounded-full hover:text-slate-900 hover:bg-slate-100 transition">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a href="/login" className="text-[13.5px] text-slate-600 hover:text-slate-900 px-3 py-2">Login</a>
          <a href="/register" className="btn-primary text-[13.5px] py-2.5 px-4">
            Try free
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden h-9 w-9 rounded-full grid place-items-center ring-1 ring-slate-200 bg-white/80"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="px-5 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100">
                {l.label}
              </a>
            ))}
            <a href="/login" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100">Login</a>
            <a href="/register" onClick={() => setOpen(false)} className="btn-primary mt-2 justify-center">Try free</a>
          </div>
        </div>
      )}
    </header>
  );
}
