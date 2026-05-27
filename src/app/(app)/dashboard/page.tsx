"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKButton } from "@/components/ui/HKButton";
import { C, OR, PU, GR, AM, SG, IN, TYPE, DISPLAY, BRAND, fmtFull } from "@/components/ui/hk-design";
import { OverdueBanner } from "@/components/ui/OverdueBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  summary: {
    receivable: number;
    payable: number;
    collectedThisMonth: number;
    collectedLastMonth?: number;
    thisMonthBilledTotal?: number;
    lastMonthBilledTotal?: number;
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
  thisMonthBillStats?: {
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
  isOnboardingComplete: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── SVG chart helpers ─────────────────────────────────────────────────────────

function makePts(data: { [key: string]: unknown }[], key: string, W: number, H: number, max: number) {
  return data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * W,
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

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, color, onClick, isMobile,
}: {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  isMobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--sb-card)",
        borderRadius: 16,
        border: `1px solid ${hovered ? "var(--sb-border-strong)" : "var(--sb-border)"}`,
        boxShadow: hovered ? "var(--sb-shadow-card-hover)" : "var(--sb-shadow-card)",
        padding: isMobile ? "14px" : "18px",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-1px)" : "none",
        width: "100%",
        fontFamily: SG,
      }}
    >
      <p style={{
        fontSize: 12, fontWeight: 600, color: "var(--sb-muted)",
        letterSpacing: "0.1px",
        marginBottom: 6, margin: "0 0 6px",
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        color,
        fontSize: isMobile ? 22 : 28,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        fontVariantNumeric: "tabular-nums",
        margin: 0,
      }}>
        {fmtFull(value)}
      </p>
    </button>
  );
}

// ── Cash Flow Chart ───────────────────────────────────────────────────────────

function CashFlowCard({ data, isMobile }: { data: DashboardData; isMobile: boolean }) {
  const { t } = useLanguage();
  const cashFlow = data.cashFlow ?? [];

  const W = 560, H = isMobile ? 120 : 140;
  const maxVal = Math.max(...cashFlow.flatMap(d => [d.received, d.paid]), 1);
  const recPts = makePts(cashFlow as { [key: string]: unknown }[], "received", W, H, maxVal);
  const paidPts = makePts(cashFlow as { [key: string]: unknown }[], "paid", W, H, maxVal);

  return (
    <div style={{
      background: "var(--sb-card)", borderRadius: 16,
      border: "1px solid var(--sb-border)",
      boxShadow: "var(--sb-shadow-card)",
      padding: isMobile ? "18px" : "22px",
    }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 8 : 0, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, color: "var(--sb-text)", margin: "0 0 2px" }}>
            {t("dash.cashFlowTitle" as TranslationKey)}
          </h2>
          <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: 0, fontFamily: SG }}>
            {t("dash.lastMonths" as TranslationKey).replace("{count}", String(cashFlow.length))}
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: GR, display: "inline-block" }}/>
            <span style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG }}>{t("dash.milaLabel" as TranslationKey)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--sb-border-strong)", display: "inline-block" }}/>
            <span style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG }}>{t("dash.billedLabel" as TranslationKey)}</span>
          </div>
        </div>
      </div>

      {cashFlow.length >= 2 ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Cash flow chart: ${cashFlow.length} months. Most recent: received ${cashFlow[cashFlow.length-1]?.received ?? 0}, paid ${cashFlow[cashFlow.length-1]?.paid ?? 0}`}
            style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}
          >
            <defs>
              <linearGradient id="hkgGR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GR} stopOpacity="0.16"/>
                <stop offset="100%" stopColor={GR} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((v, i) => (
              <line key={i}
                x1="0" y1={H - v * (H - 16) - 8}
                x2={W} y2={H - v * (H - 16) - 8}
                stroke="var(--sb-divider)" strokeWidth="1" strokeDasharray="2 4"
              />
            ))}
            <path d={areaPath(recPts, H)} fill="url(#hkgGR)"/>
            <path d={bezier(paidPts)} fill="none" stroke="var(--sb-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="5 4"/>
            <path d={bezier(recPts)} fill="none" stroke={GR} strokeWidth="2.4" strokeLinecap="round"/>
            {recPts.length > 0 && (
              <circle cx={recPts[recPts.length - 1].x} cy={recPts[recPts.length - 1].y} r="5" fill={GR}/>
            )}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {cashFlow.map((d, i) => (
              <span key={i} style={{
                fontSize: TYPE.caption, fontFamily: SG,
                fontWeight: 600, color: "var(--sb-muted)",
              }}>
                {d.month.slice(0, 3)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sb-muted)", fontSize: 13, fontFamily: SG }}>
          {t("dash.noChartData" as TranslationKey)}
        </div>
      )}
    </div>
  );
}

// ── Recent Activity Card ──────────────────────────────────────────────────────

function RecentActivityCard({ data, onNavigate, isMobile }: { data: DashboardData; onNavigate: () => void; isMobile: boolean }) {
  const { t } = useLanguage();
  const payments = (data.recentPayments ?? []).filter(p => p.party);

  return (
    <div style={{
      background: "var(--sb-card)", borderRadius: 16,
      border: "1px solid var(--sb-border)",
      boxShadow: "var(--sb-shadow-card)",
      padding: isMobile ? "16px" : "22px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, color: "var(--sb-text)", margin: 0 }}>
          {t("dash.recentActivity" as TranslationKey)}
        </h2>
        <button onClick={onNavigate} style={{
          fontSize: 13, color: "var(--sb-primary)", fontWeight: 700,
          fontFamily: SG, cursor: "pointer", background: "none", border: "none", padding: "4px 0",
        }}>
          {t("dash.viewAllArrow" as TranslationKey)}
        </button>
      </div>

      {payments.length > 0 ? (
        <div>
          {payments.slice(0, 6).map((p, i) => {
            const isIn = p.direction === "INCOMING";
            const color = isIn ? GR : C.negative;
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0",
                borderBottom: i < Math.min(payments.length, 6) - 1 ? "1px solid var(--sb-divider)" : "none",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: isIn ? C.positiveSoft : C.negativeSoft,
                  color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    {isIn
                      ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                      : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                    }
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: TYPE.bodySm, fontWeight: 600, color: "var(--sb-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: SG }}>
                    {p.party.name}
                  </p>
                  <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: "2px 0 0", fontFamily: SG }}>
                    {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t(`payments.record.mode.${p.mode.toLowerCase()}` as TranslationKey)}
                  </p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: IN, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {isIn ? "+" : "-"}{fmtFull(p.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "36px 0", color: "var(--sb-muted)", fontSize: TYPE.body, fontFamily: SG }}>
          {t("dash.noPayments" as TranslationKey)}
        </div>
      )}
    </div>
  );
}

// ── Quick Links ───────────────────────────────────────────────────────────────

function QuickLinks({ isMobile, onNavigate }: { isMobile: boolean; onNavigate: (href: string) => void }) {
  const { t } = useLanguage();
  const links = [
    { label: t("dash.quick.tally.title" as TranslationKey),    sub: t("dash.quick.tally.desc" as TranslationKey),       href: "/settings/tally-export",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
    { label: t("dash.quick.reconcile.title" as TranslationKey), sub: t("dash.quick.reconcile.desc" as TranslationKey),  href: "/settings/reconcile",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg> },
    { label: t("dash.quick.reports.title" as TranslationKey),        sub: t("dash.quick.reports.desc" as TranslationKey),          href: "/reports",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg> },
    { label: t("dash.quick.settings.title" as TranslationKey),       sub: t("dash.quick.settings.desc" as TranslationKey),  href: "/settings/company",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
      gap: 10,
    }}>
      {links.map(q => {
        const [hovered, setHovered] = useState(false);
        return (
          <button key={q.label}
            onClick={() => onNavigate(q.href)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              background: "var(--sb-card)",
              borderRadius: 14,
              border: `1px solid ${hovered ? "var(--sb-border-strong)" : "var(--sb-border)"}`,
              boxShadow: hovered ? "var(--sb-shadow-card-hover)" : "var(--sb-shadow-card)",
              padding: "14px",
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              transform: hovered ? "translateY(-1px)" : "none",
              display: "flex", gap: 10, alignItems: "center",
              fontFamily: SG,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--sb-surface-alt)",
              color: "var(--sb-sub)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>{q.icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: TYPE.bodySm, fontWeight: 700, color: "var(--sb-text)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {q.label}
              </p>
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {q.sub}
              </p>
            </div>
          </button>
        );
      })}
    </div>
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
  const [onboardingReady, setOnboardingReady] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [hasGstin, setHasGstin] = useState<boolean | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const isMobile = useIsMobile();

  const fetchDashboard = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError(null);
    try {
      const [dashRes, partiesRes, meRes, settingsRes] = await Promise.all([
        fetch("/api/dashboard", { signal: controller.signal }),
        fetch("/api/parties?limit=5", { signal: controller.signal }),
        fetch("/api/auth/me", { signal: controller.signal }),
        fetch("/api/settings", { signal: controller.signal }),
      ]);
      if (!dashRes.ok) throw new Error("Failed to load dashboard data");
      const d = await dashRes.json() as DashboardData;
      if (partiesRes.ok) {
        const pd = await partiesRes.json();
        d.topParties = pd.parties ?? [];
      }
      if (meRes.ok) {
        const me = await meRes.json();
        const fullName: string = me?.user?.name ?? me?.name ?? "";
        setUserName(fullName.split(" ")[0] || "");
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setBusinessName(settingsData?.settings?.companyName ?? "");
        setHasGstin(!!settingsData?.settings?.companyGstin);
      } else {
        setHasGstin(false);
      }
      const bankRes = await fetch("/api/bank-accounts?limit=1", { signal: controller.signal });
      if (bankRes.ok) {
        const bd = await bankRes.json();
        setHasBankAccount((bd.accounts ?? bd.bankAccounts ?? []).length > 0);
      } else {
        setHasBankAccount(false);
      }
      setData(d);
      setOnboardingReady(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(t("dash.errorNetwork" as TranslationKey));
      setOnboardingReady(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchDashboard]);

  if (loading || !onboardingReady) {
    return (
      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px" }}>
        <div style={{ marginBottom: 18 }}>
          <HKSkeleton className="h-3 w-16 rounded mb-2"/>
          <HKSkeleton className="h-8 w-48 rounded-xl mb-2"/>
          <HKSkeleton className="h-3 w-64 rounded"/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[1,2,3,4].map(i => <HKSkeleton key={i} className="h-24 rounded-2xl"/>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <HKSkeleton className="h-64 rounded-2xl"/>
          <HKSkeleton className="h-64 rounded-2xl"/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
          {[1,2,3,4].map(i => <HKSkeleton key={i} className="h-16 rounded-xl"/>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", textAlign: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.negativeSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" fill="none" stroke={C.negative} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", marginBottom: 8, fontFamily: SG }}>{error}</h2>
          <p style={{ fontSize: TYPE.body, fontWeight: 500, color: "var(--sb-sub)", fontFamily: SG }}>{t("dash.errorRetry")}</p>
        </div>
        <HKButton onClick={() => { setLoading(true); fetchDashboard(); }}>{t("dash.tryAgain" as TranslationKey)}</HKButton>
      </div>
    );
  }

  if (!data) return null;

  const now = new Date();
  const today = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const mo = now.getMonth();
  const dy = now.getDate();
  const showTallyNudge = (mo % 3 === 2 && dy >= 15) || (mo % 3 === 0 && dy <= 15);
  const s = data.summary;

  const metrics = [
    { label: t("dash.receivableLabel" as TranslationKey),        value: Math.abs(s.receivable),           color: C.positive, onClick: () => router.push("/parties?filter=overdue") },
    { label: t("dash.payableLabel" as TranslationKey),           value: Math.abs(s.payable),              color: C.negative, onClick: () => router.push("/parties") },
    { label: t("dash.collected" as TranslationKey),              value: s.collectedThisMonth,             color: C.positive, onClick: () => router.push("/payments") },
    { label: t("dash.billedThisMonth" as TranslationKey),        value: s.thisMonthBilledTotal ?? 0,      color: "var(--sb-text)", onClick: () => router.push("/bills") },
  ];

  return (
    <div style={{
      padding: isMobile ? "18px 14px 100px" : "24px 28px",
      maxWidth: 1440, margin: "0 auto",
    }}>
      {/* Install banner */}
      {canInstall && !bannerDismissed && (
        <div style={{
          marginBottom: 20, padding: "12px 16px", borderRadius: 14,
          background: C.infoSoft, border: `1px solid ${PU}28`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 22 }}>📲</span>
            <div>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>{t("install.banner")}</p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", marginTop: 2, fontFamily: SG, margin: "2px 0 0" }}>{t("install.message")}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <HKButton size="sm" variant="ghost" onClick={() => setBannerDismissed(true)}>✕</HKButton>
            <HKButton size="sm" onClick={promptInstall}>{t("install.button" as TranslationKey)}</HKButton>
          </div>
        </div>
      )}

      {/* Tally quarterly nudge */}
      {showTallyNudge && (
        <div
          onClick={() => router.push("/settings/tally-export")}
          style={{
            marginBottom: 16, padding: isMobile ? "10px 14px" : "12px 16px", borderRadius: 14,
            background: "var(--sb-primary-soft)",
            border: "1px solid var(--sb-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            cursor: "pointer", flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 20 }}>📁</span>
            <div>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>{t("dash.tallyNudgeTitle")}</p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", fontFamily: SG, margin: "2px 0 0" }}>{t("dash.tallyNudgeSubtitle")}</p>
            </div>
          </div>
          <span style={{ color: "var(--sb-primary)", fontWeight: 700, fontSize: 13, fontFamily: SG, whiteSpace: "nowrap" }}>
            {t("dash.tallyNudgeAction")}
          </span>
        </div>
      )}

      {/* Hero header */}
      <div style={{ marginBottom: 18, position: "relative", paddingLeft: 16 }}>
        <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: "var(--sb-primary)", opacity: 0.55 }}/>
        <p style={{ fontFamily: BRAND, fontSize: 14, fontWeight: 500, color: "var(--sb-muted)", marginBottom: 2, fontStyle: "italic", margin: "0 0 2px" }}>
          {t("dash.namaste" as TranslationKey)}
        </p>
        <h1 style={{ fontFamily: DISPLAY, fontSize: isMobile ? TYPE.h1Mobile : 32, fontWeight: 600, color: "var(--sb-text)", letterSpacing: "-0.01em", lineHeight: 1.15, margin: 0 }}>
          {userName ? `${userName} 👋` : t("dash.pageTitle")}
        </h1>
        <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-muted)", margin: "5px 0 0", fontFamily: SG }}>
          {businessName ? `${businessName} · ${today}` : today}
        </p>
      </div>

      {/* Setup nudge cards */}
      {(hasGstin === false || hasBankAccount === false) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}>
          {hasGstin === false && (
            <button
              onClick={() => router.push("/settings/company")}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderRadius: 14,
                background: "var(--sb-surface-alt)",
                border: "1.5px dashed var(--sb-border-strong)",
                cursor: "pointer", textAlign: "left", width: "100%",
                fontFamily: SG,
              }}
            >
              <span style={{ fontSize: 22 }}>🧾</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: TYPE.bodySm, fontWeight: 700, color: "var(--sb-text)", margin: 0 }}>{t("dash.nudge.gstin.title" as TranslationKey)}</p>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: "2px 0 0" }}>{t("dash.nudge.gstin.desc" as TranslationKey)}</p>
              </div>
              <span style={{ color: "var(--sb-muted)", fontSize: 13 }}>→</span>
            </button>
          )}
          {hasBankAccount === false && (
            <button
              onClick={() => router.push("/banking")}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderRadius: 14,
                background: "var(--sb-surface-alt)",
                border: "1.5px dashed var(--sb-border-strong)",
                cursor: "pointer", textAlign: "left", width: "100%",
                fontFamily: SG,
              }}
            >
              <span style={{ fontSize: 22 }}>🏦</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: TYPE.bodySm, fontWeight: 700, color: "var(--sb-text)", margin: 0 }}>{t("dash.nudge.bank.title" as TranslationKey)}</p>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: "2px 0 0" }}>{t("dash.nudge.bank.desc" as TranslationKey)}</p>
              </div>
              <span style={{ color: "var(--sb-muted)", fontSize: 13 }}>→</span>
            </button>
          )}
        </div>
      )}

      {/* Overdue banner */}
      <OverdueBanner
        overdueCount={s.overdueCount}
        overdueAmount={s.overdueAmount}
        overdueParty={s.overdueParty}
      />

      {/* 4 Metric cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 16,
      }}>
        {metrics.map(m => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            color={m.color}
            onClick={m.onClick}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Chart + Recent Activity */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}>
        <CashFlowCard data={data} isMobile={isMobile} />
        <RecentActivityCard data={data} onNavigate={() => router.push("/payments")} isMobile={isMobile} />
      </div>

      {/* Quick links */}
      <QuickLinks isMobile={isMobile} onNavigate={href => router.push(href)} />
    </div>
  );
}
