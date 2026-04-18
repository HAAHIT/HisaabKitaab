"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Chip,
  Skeleton,
  Button,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import {
  ONBOARDING_DISMISSED_KEY,
  SetupWizard,
} from "@/components/onboarding/SetupWizard";

interface DashboardData {
  summary: {
    receivable: number;
    payable: number;
    collectedThisMonth: number;
    netBalance: number;
    overdueCount: number;
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
  billStats: { status: string; _count: number; _sum: { grandTotal: number | null } }[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function CashFlowBar({ data }: { data: DashboardData["cashFlow"] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.received, d.paid]), 1);

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="flex gap-[2px] w-full justify-center items-end" style={{ height: "120px" }}>
            <div
              className="w-3 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t"
              style={{ height: `${(d.received / maxVal) * 100}%`, minHeight: d.received > 0 ? "4px" : "0" }}
              title={`Received: ${formatCurrency(d.received)}`}
            />
            <div
              className="w-3 bg-gradient-to-t from-orange-500 to-amber-400 rounded-t"
              style={{ height: `${(d.paid / maxVal) * 100}%`, minHeight: d.paid > 0 ? "4px" : "0" }}
              title={`Paid: ${formatCurrency(d.paid)}`}
            />
          </div>
          <span className="text-[10px] text-default-400">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const d = await res.json();
      setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    let isMounted = true;

    async function checkOnboarding() {
      try {
        const dismissed =
          typeof window !== "undefined" &&
          window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";

        if (dismissed) {
          if (isMounted) {
            setShowOnboarding(false);
            setOnboardingReady(true);
          }
          return;
        }

        const [partiesRes, templatesRes] = await Promise.all([
          fetch("/api/parties?limit=1"),
          fetch("/api/templates?limit=1"),
        ]);

        if (!partiesRes.ok || !templatesRes.ok) {
          if (isMounted) {
            setShowOnboarding(false);
            setOnboardingReady(true);
          }
          return;
        }

        const [partiesData, templatesData] = await Promise.all([
          partiesRes.json().catch(() => ({ parties: [] })),
          templatesRes.json().catch(() => ({ templates: [] })),
        ]);

        if (!isMounted) {
          return;
        }

        const noParties = !partiesData.parties?.length;
        const noTemplates = !templatesData.templates?.length;

        setShowOnboarding(noParties && noTemplates);
        setOnboardingReady(true);
      } catch {
        if (isMounted) {
          setShowOnboarding(false);
          setOnboardingReady(true);
        }
      }
    }

    checkOnboarding();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !onboardingReady) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <SetupWizard
        onComplete={() => {
          setShowOnboarding(false);
          void fetchDashboard();
        }}
      />
    );
  }

  const s = data?.summary;
  const billTotal = data?.billStats?.reduce((acc, b) => acc + Number(b._sum.grandTotal || 0), 0) || 0;
  const billCount = data?.billStats?.reduce((acc, b) => acc + b._count, 0) || 0;

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      {canInstall && !bannerDismissed && (
        <div className="mx-4 mt-4 mb-6 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📲</span>
            <div>
              <p className="text-sm font-medium">{t("install.banner")}</p>
              <p className="text-xs text-default-500">{t("install.message")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={() => setBannerDismissed(true)}>
              ✕
            </Button>
            <Button size="sm" color="primary" variant="flat" className="hover:scale-105 transition-all" onPress={promptInstall}>
              Install
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <p className="text-default-500 text-sm mt-1">{t("dash.overview")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card shadow="none" isPressable onPress={() => router.push("/parties")} className="glass-card hover:scale-105 transition-all">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
              </div>
              <span className="text-sm text-default-500">{t("dash.receivable")}</span>
            </div>
            <p className="text-2xl font-bold text-danger">{formatCurrency(s?.receivable || 0)}</p>
          </CardBody>
        </Card>

        <Card shadow="none" isPressable onPress={() => router.push("/parties")} className="glass-card hover:scale-105 transition-all">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-sm text-default-500">{t("dash.payable")}</span>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(s?.payable || 0)}</p>
          </CardBody>
        </Card>

        <Card shadow="none" isPressable onPress={() => router.push("/payments")} className="glass-card hover:scale-105 transition-all">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-sm text-default-500">{t("dash.collected")}</span>
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(s?.collectedThisMonth || 0)}</p>
          </CardBody>
        </Card>

        <Card shadow="none" isPressable onPress={() => router.push("/bills")} className="glass-card hover:scale-105 transition-all">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <span className="text-sm text-default-500">{t("dash.totalBills")}</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(billTotal)}</p>
            <p className="text-xs text-default-400 mt-1">{billCount} {t("dash.billsCount")}</p>
          </CardBody>
        </Card>
      </div>

      {/* Inner row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Cash Flow Chart */}
        <Card shadow="none" className="glass-card">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t("dash.cashFlow")}</h3>
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-default-400">{t("dash.received")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-default-400">{t("dash.paid")}</span>
                </div>
              </div>
            </div>
            {data?.cashFlow && data.cashFlow.length > 0 ? (
              <CashFlowBar data={data.cashFlow} />
            ) : (
              <div className="h-40 flex items-center justify-center text-default-400 text-sm">
                {t("dash.noPaymentData")}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Payments */}
        <Card shadow="none" className="glass-card">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t("dash.recentPayments")}</h3>
              <button onClick={() => router.push("/payments")} className="text-xs text-primary hover:underline">{t("dash.viewAll")} →</button>
            </div>
            {data?.recentPayments && data.recentPayments.length > 0 ? (
              <div className="space-y-3">
                {data.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-divider/30 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{p.party.name}</p>
                      <p className="text-xs text-default-400">
                        {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} • {p.mode.toLowerCase().replace("_", " ")}
                      </p>
                    </div>
                    <span className={`font-mono font-semibold text-sm ${p.direction === "INCOMING" ? "text-success" : "text-warning"}`}>
                      {p.direction === "INCOMING" ? "+" : "-"}{formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-default-400 text-sm">
                {t("dash.noPayments")}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Bottom Row — Overdue / Bill Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Overdue Alert */}
        {(s?.overdueCount || 0) > 0 && (
          <Card shadow="sm" className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-danger/20">
            <CardBody className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-danger">{t("dash.overdueParties")}</p>
                  <p className="text-sm text-default-500">{s?.overdueCount} {t("dash.overdueDetail")}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Bill Stats */}
        <Card shadow="none" className="glass-card">
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">{t("dash.billSummary")}</h3>
            <div className="flex flex-wrap gap-3">
              {data?.billStats?.map((stat) => (
                <div key={stat.status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-50 dark:bg-default-100/5">
                  <Chip size="sm" variant="flat" color={stat.status === "FINAL" ? "success" : stat.status === "DRAFT" ? "default" : "danger"} className="capitalize">
                    {stat.status.toLowerCase()}
                  </Chip>
                  <div>
                    <p className="text-sm font-semibold">{stat._count}</p>
                    <p className="text-xs text-default-400">{formatCurrency(stat._sum.grandTotal || 0)}</p>
                  </div>
                </div>
              ))}
              {(!data?.billStats || data.billStats.length === 0) && (
                <p className="text-sm text-default-400">{t("dash.noBills")}</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
