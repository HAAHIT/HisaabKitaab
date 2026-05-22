import type { ReactNode } from "react";

export function PhoneFrame({
  children,
  className = "",
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <>
          <div className="absolute -inset-10 bg-[radial-gradient(closest-side,rgba(37,99,235,0.10),transparent_70%)] blur-2xl" aria-hidden />
          <div className="absolute -inset-16 bg-[radial-gradient(closest-side,rgba(37,99,235,0.06),transparent_70%)] blur-3xl" aria-hidden />
        </>
      )}
      <div className="relative mx-auto w-[320px] sm:w-[360px] md:w-[380px] rounded-[3rem] border border-slate-200 bg-gradient-to-b from-slate-800 to-slate-900 p-3 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.25)]">
        <div className="absolute left-1/2 top-2 z-10 h-7 w-32 -translate-x-1/2 rounded-full bg-black/80 ring-1 ring-white/5" />
        <div className="relative h-[640px] sm:h-[700px] overflow-hidden rounded-[2.4rem] bg-[#0a0d10] ring-1 ring-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.06),transparent_60%)]" aria-hidden />
          {children}
        </div>
      </div>
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-4 pb-2 text-[10px] font-medium text-white/70">
      <span className="font-mono">9:41</span>
      <div className="flex items-center gap-1">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 8.5h2v1H1zm3-2h2v3H4zm3-2h2v5H7zm3-2h2v7h-2z" fill="currentColor"/></svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M7 1C4.5 1 2.4 2 1 3.4l1 1c1.2-1.2 3-2 5-2s3.8.8 5 2l1-1C11.6 2 9.5 1 7 1Zm0 3c-1.5 0-2.9.6-4 1.6l1 1c.9-.8 1.9-1.2 3-1.2s2.1.4 3 1.2l1-1c-1.1-1-2.5-1.6-4-1.6Zm0 3c-.7 0-1.4.3-2 .7l2 2 2-2c-.6-.4-1.3-.7-2-.7Z" fill="currentColor"/></svg>
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none"><rect x="0.5" y="1.5" width="14" height="7" rx="2" stroke="currentColor"/><rect x="2" y="3" width="11" height="4" rx="1" fill="currentColor"/><rect x="15.5" y="3.5" width="1.5" height="3" rx="0.5" fill="currentColor"/></svg>
      </div>
    </div>
  );
}
