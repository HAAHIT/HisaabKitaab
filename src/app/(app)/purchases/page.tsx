"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKPagination } from "@/components/ui/HKPagination";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  C, GR, SG, IN, TYPE,
  fmtFull, useIsMobile,
  HKCard, StatusChip, HKToast, SearchBox, PillFilter,
  PageHeader, HKAvatar,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

interface Bill {
  id: string;
  billNumber: string;
  party: { id: string; name: string; type: string } | null;
  customerName: string;
  grandTotal: number;
  status: string;
  createdAt: string;
  date?: string;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function PurchasesListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<{ kulBilled: number; mila: number; baaki: number }>({ kulBilled: 0, mila: 0, baaki: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "FINAL" | "CANCELLED">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const monthlyBillGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
    const groups = new Map<string, { label: string; bills: Bill[]; total: number }>();
    for (const bill of bills) {
      const d = new Date(bill.date ?? bill.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.bills.push(bill);
        existing.total += Number(bill.grandTotal);
      } else {
        groups.set(key, { label: monthFormatter.format(d), bills: [bill], total: Number(bill.grandTotal) });
      }
    }
    return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }));
  }, [bills]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("partyType", "VENDOR");
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));

      const response = await fetch(`/api/bills?${params.toString()}`);
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      setBills((data.bills || []) as Bill[]);
      setTotalPages(data.totalPages || 1);
      if (data.summary) setSummary(data.summary);
    } catch (error) {
      setBills([]);
      setTotalPages(1);
      setSummary({ kulBilled: 0, mila: 0, baaki: 0 });
      showToast(error instanceof Error ? error.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const totalFinal = bills.filter((b) => b.status === "FINAL").length;
  const totalDraft = bills.filter((b) => b.status === "DRAFT").length;
  const totalCancel = bills.filter((b) => b.status === "CANCELLED").length;

  const filterOptions = [
    { key: "ALL" as const, label: `${t("purchases.filter.all")} (${bills.length})` },
    { key: "FINAL" as const, label: `${t("purchases.filter.final")} (${totalFinal})` },
    { key: "DRAFT" as const, label: `${t("purchases.filter.draft")} (${totalDraft})` },
    { key: "CANCELLED" as const, label: `${t("purchases.filter.cancelled")} (${totalCancel})` },
  ];

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        <PageHeader
          title={t("purchases.pageTitle")}
          subtitle={t("purchases.pageSubtitle")}
          isMobile={isMobile}
          action={
            !isMobile && (
              <HKButton onClick={() => router.push("/purchases/new")}>
                {t("purchases.recordBtn")}
              </HKButton>
            )
          }
        />

        {/* Month metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { l: t("purchases.metric.purchased"), v: fmtFull(summary.kulBilled), sub: t("purchases.metric.thisMonth"), c: "var(--sb-text)", bg: "var(--sb-card)" },
            { l: t("purchases.metric.paid"), v: fmtFull(summary.mila), sub: t("purchases.metric.paidOut"), c: GR, bg: C.positiveSoft },
            { l: t("purchases.metric.due"), v: fmtFull(summary.baaki), sub: t("purchases.metric.toPay"), c: C.primary, bg: C.primarySoft },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "16px 16px",
                borderRadius: 14,
                background: item.bg,
                border: "1px solid var(--sb-border)",
                boxShadow: "var(--sb-shadow-card)",
              }}
            >
              <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontFamily: SG }}>
                {item.l}
              </p>
              <p style={{ fontSize: isMobile ? TYPE.numSmall : TYPE.numLarge, fontWeight: 800, color: item.c, fontFamily: IN, lineHeight: 1 }}>
                {item.v}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", marginTop: 4, fontFamily: SG }}>{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <SearchBox value={search} onChange={setSearch} placeholder={t("bills.searchPlaceholder")} />
          <PillFilter
            options={filterOptions}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <HKSkeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--sb-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🛒</div>
            <p style={{ fontWeight: 700, fontSize: TYPE.h2, color: "var(--sb-text)", marginBottom: 8, fontFamily: SG }}>
              {search || statusFilter !== "ALL" ? "Koi purchase nahi mila" : "Abhi tak koi purchase nahi"}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || statusFilter !== "ALL" ? "Search badlo ya naya purchase record karo" : "Pehla purchase record karke shuru karo"}
            </p>
            {!search && statusFilter === "ALL" && (
              <HKButton onClick={() => router.push("/purchases/new")}>
                + Record Purchase
              </HKButton>
            )}
          </div>
        ) : (
          <>
            {monthlyBillGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => toggleMonth(group.key)}
                    aria-expanded={!isCollapsed}
                    style={{
                      width: "100%",
                      minHeight: 48,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderRadius: 12,
                      background: "var(--sb-badge)",
                      border: "1px solid var(--sb-border)",
                      marginBottom: 10,
                      cursor: "pointer",
                      fontFamily: SG,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: IN }}>
                        {fmtFull(group.total)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)" }}>
                        · {group.bills.length} bills
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--sb-sub)" strokeWidth="1.8" strokeLinecap="round"
                        style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <HKCard style={{ padding: "0 16px" }}>
                      {group.bills.map((bill, i) => (
                        <div
                          key={bill.id}
                          onClick={() => router.push(`/purchases/${bill.id}`)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "16px 0",
                            borderBottom: i < group.bills.length - 1 ? "1px solid var(--sb-border)" : "none",
                            cursor: "pointer",
                            minHeight: 64,
                          }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
                            <HKAvatar name={bill.party?.name || bill.customerName || "—"} size={40} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {bill.party?.name || bill.customerName}
                                </span>
                                <StatusChip status={bill.status} />
                              </div>
                              <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: IN, margin: 0 }}>
                                {bill.billNumber} · {new Date(bill.date ?? bill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: "var(--sb-text)", fontFamily: IN, whiteSpace: "nowrap" }}>
                              {fmtFull(bill.grandTotal)}
                            </p>
                            <svg style={{ color: "var(--sb-sub)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </HKCard>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                <HKPagination total={totalPages} page={page} onChange={setPage} showControls />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
