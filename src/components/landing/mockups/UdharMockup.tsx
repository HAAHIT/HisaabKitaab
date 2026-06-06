import { PhoneFrame, StatusBar } from "./PhoneFrame";

const parties = [
  { name: "Sunita Textiles", balance: 24800, days: 9, hue: "rose", initial: "S" },
  { name: "Mohan Wholesale", balance: 12450, days: 4, hue: "amber", initial: "M" },
  { name: "Priya Electronics", balance: 7200, days: 2, hue: "amber", initial: "P" },
  { name: "Anwar & Sons", balance: -3400, days: 0, hue: "jade", initial: "A" },
  { name: "Geeta Stationery", balance: 5600, days: 1, hue: "amber", initial: "G" },
];

const hueClasses: Record<string, { bg: string; ring: string; text: string }> = {
  rose: { bg: "bg-rose-500/15", ring: "ring-rose-400/30", text: "text-rose-300" },
  amber: { bg: "bg-amber-500/15", ring: "ring-amber-400/30", text: "text-amber-300" },
  jade: { bg: "bg-emerald-500/15", ring: "ring-emerald-400/30", text: "text-emerald-300" },
};

export function UdharMockup() {
  return (
    <PhoneFrame>
      <StatusBar />
      <div className="px-5 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40">Udhar Khata</p>
          <h3 className="text-[18px] font-semibold text-white mt-0.5">Lena baaki hai</h3>
        </div>
        <button className="rounded-full bg-white/5 ring-1 ring-white/10 h-9 w-9 grid place-items-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      </div>

      <div className="px-5 mt-2">
        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.06] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-rose-200/80">Aaj tak lena baaki</p>
            <span className="text-[10px] font-mono text-rose-200/60">5 parties</span>
          </div>
          <p className="mt-1 text-[26px] font-semibold text-rose-200 font-display">₹46,650</p>
          <div className="mt-3 flex items-center gap-2">
            <button className="flex-1 rounded-full bg-white text-[#0f1316] text-[12px] font-semibold py-2 flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.2 1.6 6L0 24l6.2-1.6c1.7.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0Z" opacity=".2" /><path d="M12 2c-5.5 0-10 4.5-10 10 0 1.8.5 3.5 1.4 5L2 22l5.1-1.4c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2Z" /></svg>
              WhatsApp sab ko
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 px-5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
          <span>Parties · sorted by lena baaki</span>
        </div>
        <div className="space-y-1.5">
          {parties.map((p) => {
            const h = hueClasses[p.hue];
            return (
              <div key={p.name} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 ring-1 ring-white/[0.04]">
                <div className={`h-9 w-9 rounded-full grid place-items-center text-[13px] font-semibold ring-1 ${h.bg} ${h.ring} ${h.text}`}>
                  {p.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white truncate">{p.name}</p>
                  <p className="text-[10.5px] text-white/40">
                    {p.balance >= 0 ? `${p.days} din se baaki` : "Aapko paisa dena hai"}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-[13px] font-semibold ${p.balance >= 0 ? "text-rose-200" : "text-emerald-300"}`}>
                    {p.balance >= 0 ? "₹" : "−₹"}
                    {Math.abs(p.balance).toLocaleString("en-IN")}
                  </p>
                  <div className="mt-0.5 flex justify-end gap-1.5 text-white/40">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72a2 2 0 0 1 1.72 2z" /></svg>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.5 0-10 4.5-10 10 0 1.8.5 3.5 1.4 5L2 22l5.1-1.4c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2Z" opacity=".7" /></svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-3 right-4">
        <button className="h-12 w-12 rounded-full bg-[#2563eb] text-white grid place-items-center shadow-[0_18px_36px_-12px_rgba(37,99,235,0.5)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </PhoneFrame>
  );
}
