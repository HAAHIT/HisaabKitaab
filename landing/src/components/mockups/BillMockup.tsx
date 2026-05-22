import { PhoneFrame, StatusBar } from "./PhoneFrame";

const lineItems = [
  { name: "Basmati Rice 25kg", qty: 4, rate: 1850, amt: 7400 },
  { name: "Sunflower Oil 15L", qty: 2, rate: 1640, amt: 3280 },
  { name: "Toor Dal 30kg", qty: 1, rate: 4200, amt: 4200 },
  { name: "Chini 50kg", qty: 1, rate: 2150, amt: 2150 },
];

export function BillMockup() {
  const subtotal = lineItems.reduce((s, l) => s + l.amt, 0);
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;

  return (
    <PhoneFrame>
      <StatusBar />
      <div className="px-5 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          <span>Naya Bill</span>
        </div>
        <span className="font-mono text-[10px] text-[#28e0a8]">BILL-202605-018</span>
      </div>

      <div className="px-5 pt-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Party</p>
          <p className="mt-0.5 text-[15px] font-semibold text-white">Ramesh General Store</p>
          <p className="mt-0.5 text-[11px] text-white/50">Karol Bagh · +91 98••• 22141</p>
        </div>
      </div>

      <div className="mt-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Items · 4</p>
          <span className="text-[10px] text-[#28e0a8] font-medium">+ Add item</span>
        </div>
        <div className="space-y-1.5">
          {lineItems.map((l) => (
            <div key={l.name} className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2.5">
              <div>
                <p className="text-[12.5px] text-white">{l.name}</p>
                <p className="font-mono text-[10px] text-white/40">{l.qty} × ₹{l.rate}</p>
              </div>
              <p className="text-[12.5px] font-medium text-white">₹{l.amt.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 px-5 pb-6 pt-4 bg-gradient-to-t from-[#07090a] via-[#07090a] to-transparent">
        <div className="rounded-2xl border border-[#28e0a8]/20 bg-[#28e0a8]/[0.06] p-4">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Subtotal</span><span className="font-mono">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/60 mt-1">
            <span>GST 5%</span><span className="font-mono">₹{gst.toLocaleString("en-IN")}</span>
          </div>
          <div className="my-2.5 h-px bg-white/10" />
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wider text-white/50">Total</span>
            <span className="text-[22px] font-semibold text-[#4fe9b9]">₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-full bg-[#28e0a8] text-[#06140e] font-semibold text-[13px] py-3">
            Pakka karo
          </button>
          <button className="rounded-full border border-white/10 bg-white/[0.04] text-white font-medium text-[13px] py-3 px-4 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            Share
          </button>
        </div>
        <p className="text-center text-[10px] text-white/30 mt-3">Tap and hold a row to delete · GST auto-calculated</p>
      </div>
    </PhoneFrame>
  );
}
