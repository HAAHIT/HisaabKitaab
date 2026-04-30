"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import {
  ONBOARDING_DISMISSED_KEY,
  SetupWizard,
} from "@/components/onboarding/SetupWizard";
import { Button, Skeleton } from "@heroui/react";
import { OR, PU, GR, AM, SG, IN, TYPE } from "@/components/ui/hk-design";
import { OverdueBanner } from "@/components/ui/OverdueBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  summary: {
    receivable: number;
    payable: number;
    collectedThisMonth: number;
    netBalance: number;
    overdueCount: number;
    overdueAmount: number;
    overdueParty?: string | null;
  };
  cashFlow: { month: string; received: number; paid: number }[];
  recentPayments: {
    id: string;
    amount: number;
    direction: string;
    mode: string;
    date: string;
    party: { name: string; type: string };
  }[];
  billStats: {
    status: string;
    _count: number;
    _sum: { grandTotal: number | null };
  }[];
  topParties?: {
    id: string;
    name: string;
    currentBalance: number;
    type: string;
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return "₹" + (abs / 100000).toFixed(1) + "L";
  if (abs >= 1000) return "₹" + Math.round(abs / 1000) + "K";
  return "₹" + abs;
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

function useIsMobile() {
  const [m, setM] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function HKCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--hk-card)", borderRadius: 20,
      border: "1px solid var(--hk-border)", padding: "20px",
      transition: "background 0.25s", ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ label, title, right }: { label: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
      <div>
        <p style={{ color: "var(--hk-sub)", fontSize: TYPE.caption, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, letterSpacing: "-0.3px" }}>
          {title}
        </p>
      </div>
      {right}
    </div>
  );
}

function DeltaBadge({ val, color }: { val: number; color?: string }) {
  const c = color ?? (val >= 0 ? GR : OR);
  return (
    <span style={{ fontSize: TYPE.chip, fontWeight: 700, color: c, background: c + "22", padding: "3px 9px", borderRadius: 7, fontFamily: IN, whiteSpace: "nowrap" }}>
      {val >= 0 ? "+" : ""}{val}%
    </span>
  );
}

// ── SVG chart math ────────────────────────────────────────────────────────────

function makePts(data: { [key: string]: unknown }[], key: string, W: number, H: number, max: number) {
  return data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d[key] as number) / max) * (H - 12) - 6,
  }));
}

function bezier(P: { x: number; y: number }[]): string {
  if (!P || P.length < 2) return "";
  let d = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
  for (let i = 1; i < P.length; i++) {
    const cp = (P[i - 1].x + P[i].x) / 2;
    d += ` C${cp.toFixed(1)},${P[i - 1].y.toFixed(1)} ${cp.toFixed(1)},${P[i].y.toFixed(1)} ${P[i].x.toFixed(1)},${P[i].y.toFixed(1)}`;
  }
  return d;
}

function areaPath(P: { x: number; y: number }[], H: number): string {
  return bezier(P) + ` L${P[P.length - 1].x.toFixed(1)},${H} L${P[0].x.toFixed(1)},${H} Z`;
}

// ── Overview Card ─────────────────────────────────────────────────────────────

function OverviewCard({ data, isMobile }: { data: DashboardData; isMobile: boolean }) {
  const cashFlow = data.cashFlow ?? [];
  const [activeIdx, setActiveIdx] = useState(Math.max(cashFlow.length - 1, 0));
  const W = 560, H = isMobile ? 110 : 148;
  const maxVal = Math.max(...cashFlow.flatMap((d) => [d.received, d.paid]), 1);
  const bPts = makePts(cashFlow as { [key: string]: unknown }[], "received", W, H, maxVal);
  const cPts = makePts(cashFlow as { [key: string]: unknown }[], "paid", W, H, maxVal);

  const billTotal = data.billStats?.reduce((a, b) => a + Number(b._sum.grandTotal || 0), 0) ?? 0;
  const s = data.summary;

  const metrics = [
    { label: "Kul Billed", value: billTotal, color: PU, delta: 18 },
    { label: "Mila", value: s.collectedThisMonth, color: OR, delta: 12 },
    { label: "Baaki", value: Math.abs(s.receivable), color: GR, delta: -4 },
  ];

  return (
    <HKCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", flex: 1 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              paddingRight: isMobile ? 10 : 22,
              borderRight: i < 2 ? "1px solid var(--hk-border)" : "none",
              paddingLeft: i > 0 ? (isMobile ? 10 : 22) : 0,
            }}>
              <p style={{ color: "var(--hk-sub)", fontSize: TYPE.label, fontWeight: 600, fontFamily: SG, marginBottom: 6 }}>{m.label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: isMobile ? TYPE.numMedium + 4 : TYPE.numLarge, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN, letterSpacing: "-1px", lineHeight: 1 }}>
                  {fmt(m.value)}
                </span>
                <DeltaBadge val={m.delta} color={m.color} />
              </div>
            </div>
          ))}
        </div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 5, flexShrink: 0, marginLeft: 16 }}>
            {["1M", "3M", "6M", "1Y"].map((f) => (
              <button key={f} style={{
                minHeight: 36, padding: "0 14px", borderRadius: 9,
                border: `1px solid ${f === "6M" ? OR : "var(--hk-border)"}`,
                background: f === "6M" ? OR : "var(--hk-badge)",
                color: f === "6M" ? "#fff" : "var(--hk-sub)",
                fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG, cursor: "pointer",
              }}>{f}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: "var(--hk-border)", marginBottom: 16 }} />

      {cashFlow.length >= 2 ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}>
            <defs>
              <linearGradient id="hkgPU" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PU} stopOpacity="0.28"/><stop offset="100%" stopColor={PU} stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="hkgOR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OR} stopOpacity="0.28"/><stop offset="100%" stopColor={OR} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((v) => (
              <line key={v} x1="0" y1={H - v * (H - 12) - 6} x2={W} y2={H - v * (H - 12) - 6} stroke="var(--hk-line)" strokeWidth="1"/>
            ))}
            <path d={areaPath(bPts, H)} fill="url(#hkgPU)"/>
            <path d={areaPath(cPts, H)} fill="url(#hkgOR)"/>
            <path d={bezier(bPts)} fill="none" stroke={PU} strokeWidth="2.2" strokeLinecap="round"/>
            <path d={bezier(cPts)} fill="none" stroke={OR} strokeWidth="2.2" strokeLinecap="round"/>
            {bPts[activeIdx] && (
              <>
                <line x1={bPts[activeIdx].x} y1="0" x2={bPts[activeIdx].x} y2={H} stroke="var(--hk-border)" strokeWidth="1.5" strokeDasharray="4 3"/>
                <circle cx={bPts[activeIdx].x} cy={bPts[activeIdx].y} r="10" fill={PU} fillOpacity="0.18"/>
                <circle cx={bPts[activeIdx].x} cy={bPts[activeIdx].y} r="5" fill={PU}/>
                <circle cx={cPts[activeIdx].x} cy={cPts[activeIdx].y} r="10" fill={OR} fillOpacity="0.18"/>
                <circle cx={cPts[activeIdx].x} cy={cPts[activeIdx].y} r="5" fill={OR}/>
              </>
            )}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {cashFlow.map((d, i) => (
              <span key={i} onClick={() => setActiveIdx(i)} style={{
                fontSize: TYPE.caption, fontFamily: SG, cursor: "pointer",
                padding: "4px 8px", borderRadius: 6,
                fontWeight: i === activeIdx ? 700 : 600,
                color: i === activeIdx ? "var(--hk-text)" : "var(--hk-sub)",
                background: i === activeIdx ? "var(--hk-badge)" : "transparent",
                transition: "all 0.15s",
              }}>
                {d.month.slice(0, 3)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hk-sub)", fontSize: 13 }}>
          Koi data nahi — bills ya payments record karo
        </div>
      )}

      <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
        {[{ c: PU, l: "Kul Billed" }, { c: OR, l: "Mila" }].map((item) => (
          <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 3, borderRadius: 2, background: item.c }}/>
            <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--hk-sub)", fontFamily: SG }}>{item.l}</span>
          </div>
        ))}
      </div>
    </HKCard>
  );
}

// ── Bills Bar Card ────────────────────────────────────────────────────────────

function BillsBarCard({ data, onNavigate }: { data: DashboardData; onNavigate: () => void }) {
  const stats = data.billStats ?? [];
  const finalCount = stats.find((s) => s.status === "FINAL")?._count ?? 0;
  const draftCount = stats.find((s) => s.status === "DRAFT")?._count ?? 0;
  const cancelCount = stats.find((s) => s.status === "CANCELLED")?._count ?? 0;
  const totalBills = finalCount + draftCount + cancelCount;
  const maxCount = Math.max(finalCount, draftCount, cancelCount, 1);
  const bars = [
    { label: "Final ✓", count: finalCount, color: GR },
    { label: "Draft", count: draftCount, color: AM },
    { label: "Cancel", count: cancelCount, color: OR },
  ];

  return (
    <HKCard>
      <CardHead label="Bills" title="Is Mahine" />
      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        {bars.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: b.color }}/>
            <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--hk-sub)", fontFamily: SG }}>{b.label}</span>
          </div>
        ))}
      </div>
      {totalBills > 0 ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {bars.map((bar) => (
            <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN, lineHeight: 1 }}>{bar.count}</span>
              <div style={{ width: "100%", display: "flex", alignItems: "flex-end", height: 90 }}>
                <div style={{
                  width: "100%",
                  background: `linear-gradient(to top, ${bar.color}, ${bar.color}cc)`,
                  borderRadius: "6px 6px 0 0",
                  height: `${(bar.count / maxCount) * 100}%`,
                  minHeight: bar.count > 0 ? 4 : 0,
                }}/>
              </div>
              <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontWeight: 700, fontFamily: SG }}>{bar.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hk-sub)", fontSize: TYPE.body, fontWeight: 500 }}>
          Koi bill nahi abhi tak
        </div>
      )}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderRadius: 12, background: "var(--hk-badge)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: OR + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={OR} strokeWidth="2.2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style={{ color: "var(--hk-sub)", fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG }}>{totalBills} bills total</span>
        </div>
        <button onClick={onNavigate} style={{ color: OR, fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG, cursor: "pointer", background: "none", border: "none", padding: "6px 4px" }}>
          Dekho →
        </button>
      </div>
    </HKCard>
  );
}

// ── Payments Flow Card ────────────────────────────────────────────────────────

function PaymentsFlowCard({ data }: { data: DashboardData }) {
  const cashFlow = data.cashFlow ?? [];
  const max = Math.max(...cashFlow.flatMap((d) => [d.received, d.paid]), 1);
  const totalIn = cashFlow.reduce((s, d) => s + d.received, 0);
  const totalOut = cashFlow.reduce((s, d) => s + d.paid, 0);
  const delta = totalOut > 0 ? Math.round(((totalIn - totalOut) / totalOut) * 100) : 0;

  return (
    <HKCard>
      <CardHead label="Payments" title="6 Mahine" right={<DeltaBadge val={delta} color={delta >= 0 ? GR : OR} />} />
      {cashFlow.length >= 2 ? (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
            {cashFlow.map((d, i) => {
              const pct = Math.round((d.received / Math.max(d.received + d.paid, 1)) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontWeight: 700, fontFamily: SG }}>{pct}%</span>
                  <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 90 }}>
                    <div style={{ flex: 1, background: `linear-gradient(to top, ${GR}, ${GR}cc)`, borderRadius: "5px 5px 0 0", height: `${(d.received / max) * 100}%`, minHeight: d.received > 0 ? 4 : 0 }}/>
                    <div style={{ flex: 1, background: `linear-gradient(to top, ${OR}88, ${OR}44)`, borderRadius: "5px 5px 0 0", height: `${(d.paid / max) * 100}%`, minHeight: d.paid > 0 ? 4 : 0 }}/>
                  </div>
                  <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontWeight: 600, fontFamily: SG }}>{d.month.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            {[{ c: GR, l: "Mila" }, { c: OR + "88", l: "Diya" }].map((item) => (
              <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: item.c }}/>
                <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--hk-sub)", fontFamily: SG }}>{item.l}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hk-sub)", fontSize: TYPE.body, fontWeight: 500, textAlign: "center" }}>
          Payments record karo chart dekhne ke liye
        </div>
      )}
    </HKCard>
  );
}

// ── Party Ledger Card ─────────────────────────────────────────────────────────

function LedgerCard({ data, onNavigate }: { data: DashboardData; onNavigate: () => void }) {
  const parties = data.topParties ?? [];
  const maxBal = Math.max(...parties.map((p) => Math.abs(p.currentBalance)), 1);
  const s = data.summary;
  const recAmt = Math.abs(s.receivable);
  const payAmt = Math.abs(s.payable);

  return (
    <HKCard>
      <CardHead label="Udhar Khata" title="Party Ledger" right={
        <button onClick={onNavigate} style={{ fontSize: TYPE.bodySmall, color: OR, fontWeight: 700, fontFamily: SG, cursor: "pointer", background: "none", border: "none", padding: "6px 4px" }}>
          Sab Dekho →
        </button>
      }/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {[
          { l: "Lena Baki", v: recAmt, c: GR, i: "↑" },
          { l: "Dena Baki", v: payAmt, c: OR, i: "↓" },
        ].map((item) => (
          <div key={item.l} style={{ padding: "12px 14px", borderRadius: 12, background: item.c + "14", border: `1px solid ${item.c}22` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <span style={{ fontSize: TYPE.body, fontWeight: 700, color: item.c }}>{item.i}</span>
              <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: item.c, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG }}>{item.l}</p>
            </div>
            <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN }}>{fmt(item.v)}</p>
          </div>
        ))}
      </div>
      {parties.slice(0, 4).map((p, i) => {
        const isLena = p.currentBalance < 0;
        const color = isLena ? GR : OR;
        const initials = p.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div key={p.id} style={{ marginBottom: i < 3 ? 14 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: TYPE.bodySmall, fontWeight: 800, color, fontFamily: IN }}>{initials}</span>
                </div>
                <span style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--hk-text)", fontFamily: SG }}>
                  {p.name.split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
              <span style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN }}>{fmt(Math.abs(p.currentBalance))}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--hk-badge)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: color, width: `${(Math.abs(p.currentBalance) / maxBal) * 100}%`, transition: "width 0.4s ease" }}/>
            </div>
          </div>
        );
      })}
      {parties.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--hk-sub)", fontSize: TYPE.body, fontWeight: 500 }}>
          Parties add karo Udhar Khata dekhne ke liye
        </div>
      )}
    </HKCard>
  );
}

// ── Collections Donut Card ────────────────────────────────────────────────────

function DonutCard({ data }: { data: DashboardData }) {
  const stats = data.billStats ?? [];
  const finalAmt = Number(stats.find((s) => s.status === "FINAL")?._sum.grandTotal ?? 0);
  const draftAmt = Number(stats.find((s) => s.status === "DRAFT")?._sum.grandTotal ?? 0);
  const total = Math.max(finalAmt + draftAmt, 1);
  const finalPct = finalAmt / total;
  const draftPct = draftAmt / total;
  const restPct = Math.max(1 - finalPct - draftPct, 0);

  const r = 60, cx = 93, cy = 93;
  const circ = 2 * Math.PI * r;
  const segs = [
    { pct: finalPct, color: GR, label: "Collect", val: `${Math.round(finalPct * 100)}%` },
    { pct: draftPct, color: PU, label: "Baaki", val: `${Math.round(draftPct * 100)}%` },
    { pct: restPct, color: OR, label: "Overdue", val: `${Math.round(restPct * 100)}%` },
  ];
  let cum = -0.25;
  const arcs = segs.map((s) => {
    const off = -(cum * circ);
    const dash = s.pct * circ;
    cum += s.pct;
    return { ...s, dash: `${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`, off };
  });

  return (
    <HKCard>
      <CardHead label="Collections" title="Breakdown" />
      <div style={{ display: "flex", justifyContent: "center", margin: "0 0 14px" }}>
        <svg width="186" height="186" viewBox="0 0 186 186">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hk-badge)" strokeWidth="18"/>
          {arcs.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="18"
              strokeLinecap="round" strokeDasharray={s.dash} strokeDashoffset={s.off}/>
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--hk-text)" fontFamily={IN}>
            {Math.round(finalPct * 100)}%
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--hk-sub)" fontFamily={SG}>
            Mila
          </text>
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {segs.map((s) => (
          <div key={s.label} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10, background: "var(--hk-badge)" }}>
            <div style={{ width: 28, height: 3, borderRadius: 2, background: s.color, margin: "0 auto 6px" }}/>
            <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontWeight: 600, fontFamily: SG, marginBottom: 3 }}>{s.label}</p>
            <p style={{ fontSize: TYPE.body, fontWeight: 800, color: s.color, fontFamily: IN }}>{s.val}</p>
          </div>
        ))}
      </div>
    </HKCard>
  );
}

// ── Recent Payments Card ──────────────────────────────────────────────────────

function RecentPaymentsCard({ data, onNavigate }: { data: DashboardData; onNavigate: () => void }) {
  const payments = data.recentPayments ?? [];
  return (
    <HKCard>
      <CardHead label="Payments" title="Recent" right={
        <button onClick={onNavigate} style={{ fontSize: TYPE.bodySmall, color: OR, fontWeight: 700, fontFamily: SG, cursor: "pointer", background: "none", border: "none", padding: "6px 4px" }}>
          Sab Dekho →
        </button>
      }/>
      {payments.length > 0 ? (
        <div>
          {payments.map((p, i) => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 0",
              borderBottom: i < payments.length - 1 ? "1px solid var(--hk-border)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: (p.direction === "INCOMING" ? GR : OR) + "18",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.direction === "INCOMING" ? GR : OR} strokeWidth="2.5" strokeLinecap="round">
                    {p.direction === "INCOMING"
                      ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                      : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                    }
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 3 }}>{p.party.name}</p>
                  <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)" }}>
                    {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {p.mode.toLowerCase().replace("_", " ")}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: p.direction === "INCOMING" ? GR : OR, fontFamily: IN, whiteSpace: "nowrap" }}>
                {p.direction === "INCOMING" ? "+" : "-"}{fmtFull(p.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "36px 0", color: "var(--hk-sub)", fontSize: TYPE.body, fontWeight: 500 }}>
          Koi payment nahi abhi tak
        </div>
      )}
    </HKCard>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchDashboard = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError(null);
    try {
      const [dashRes, partiesRes] = await Promise.all([
        fetch("/api/dashboard", { signal: controller.signal }),
        fetch("/api/parties?limit=5", { signal: controller.signal }),
      ]);
      if (!dashRes.ok) throw new Error("Failed to load dashboard data");
      const d = await dashRes.json() as DashboardData;
      if (partiesRes.ok) {
        const pd = await partiesRes.json();
        d.topParties = pd.parties ?? [];
      }
      setData(d);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Network connection interrupted");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchDashboard]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    async function checkOnboarding() {
      try {
        const dismissed =
          typeof window !== "undefined" &&
          window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
        if (dismissed) {
          if (mounted) { setShowOnboarding(false); setOnboardingReady(true); }
          return;
        }
        const [pr, tr] = await Promise.all([
          fetch("/api/parties?limit=1", { signal: controller.signal }),
          fetch("/api/templates?limit=1", { signal: controller.signal }),
        ]);
        if (!pr.ok || !tr.ok) {
          if (mounted) { setShowOnboarding(false); setOnboardingReady(true); }
          return;
        }
        const [pd, td] = await Promise.all([
          pr.json().catch(() => ({ parties: [] })),
          tr.json().catch(() => ({ templates: [] })),
        ]);
        if (!mounted) return;
        setShowOnboarding(!pd.parties?.length && !td.templates?.length);
        setOnboardingReady(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (mounted) { setShowOnboarding(false); setOnboardingReady(true); }
      }
    }
    checkOnboarding();
    return () => { mounted = false; controller.abort(); };
  }, []);

  if (loading || !onboardingReady) {
    return (
      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <Skeleton className="h-64 rounded-2xl"/><Skeleton className="h-64 rounded-2xl"/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
          <Skeleton className="h-56 rounded-2xl"/><Skeleton className="h-56 rounded-2xl"/><Skeleton className="h-56 rounded-2xl"/>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", textAlign: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: OR + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" fill="none" stroke={OR} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", marginBottom: 8, fontFamily: SG }}>{error}</h2>
          <p style={{ fontSize: TYPE.body, fontWeight: 500, color: "var(--hk-sub)", fontFamily: SG }}>Data load nahi hua. Dobara try karo.</p>
        </div>
        <Button color="primary" variant="flat" onPress={() => { setLoading(true); fetchDashboard(); }}>Try Again</Button>
      </div>
    );
  }

  if (showOnboarding) {
    return <SetupWizard onComplete={() => { setShowOnboarding(false); void fetchDashboard(); }}/>;
  }

  if (!data) return null;

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={{
      padding: isMobile ? "16px 14px" : "24px 28px",
      paddingBottom: 24,
      maxWidth: 1440, margin: "0 auto",
    }}>
      {/* Install banner */}
      {canInstall && !bannerDismissed && (
        <div style={{
          marginBottom: 20, padding: "10px 14px", borderRadius: 14,
          background: PU + "14", border: `1px solid ${PU}28`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📲</span>
            <div>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>{t("install.banner")}</p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)", marginTop: 2 }}>{t("install.message")}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="sm" variant="flat" onPress={() => setBannerDismissed(true)}>✕</Button>
            <Button size="sm" color="primary" variant="flat" onPress={promptInstall}>Install</Button>
          </div>
        </div>
      )}

      {/* Overdue banner */}
      <OverdueBanner
        overdueCount={data.summary.overdueCount}
        overdueAmount={data.summary.overdueAmount}
        overdueParty={data.summary.overdueParty}
      />

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: isMobile ? TYPE.h1Mobile : TYPE.h1, fontWeight: 700, color: "var(--hk-text)", letterSpacing: "-0.5px", fontFamily: SG, lineHeight: 1.2 }}>
            Apna Karobaar
          </h1>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "6px 12px", borderRadius: 9,
            background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--hk-sub)" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--hk-sub)", fontFamily: SG }}>{today}</span>
          </div>
        </div>
        {!isMobile && (
          <button
            onClick={() => router.push("/bills")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              minHeight: 44, padding: "0 16px", borderRadius: 11,
              border: "1px solid var(--hk-border)", background: "var(--hk-badge)",
              color: "var(--hk-sub)", fontSize: TYPE.body, fontWeight: 600, fontFamily: SG, cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filter
          </button>
        )}
      </div>

      {/* Cards grid */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <OverviewCard data={data} isMobile={true}/>
          <BillsBarCard data={data} onNavigate={() => router.push("/bills")}/>
          <PaymentsFlowCard data={data}/>
          <LedgerCard data={data} onNavigate={() => router.push("/parties")}/>
          <DonutCard data={data}/>
          <RecentPaymentsCard data={data} onNavigate={() => router.push("/payments")}/>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
            <OverviewCard data={data} isMobile={false}/>
            <BillsBarCard data={data} onNavigate={() => router.push("/bills")}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <PaymentsFlowCard data={data}/>
            <LedgerCard data={data} onNavigate={() => router.push("/parties")}/>
            <DonutCard data={data}/>
          </div>
          <RecentPaymentsCard data={data} onNavigate={() => router.push("/payments")}/>
        </>
      )}
    </div>
  );
}
