"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination, Skeleton } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  OR, GR, AM, SG, IN, TYPE,
  fmtFull, useIsMobile,
  HKCard, StatusChip, HKToast, SearchBox, PillFilter,
  PageHeader, GradientButton,
} from "@/components/ui/hk-design";

interface Bill {
  id: string;
  billNumber: string;
  party: { id: string; name: string; type: string } | null;
  customerName: string;
  grandTotal: number;
  status: string;
  createdAt: string;
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
      const d = new Date(bill.createdAt);
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
    } catch (error) {
      setBills([]);
      setTotalPages(1);
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
    { key: "ALL" as const, label: `Sab (${bills.length})` },
    { key: "FINAL" as const, label: `Final (${totalFinal})` },
    { key: "DRAFT" as const, label: `Draft (${totalDraft})` },
    { key: "CANCELLED" as const, label: `Cancel (${totalCancel})` },
  ];

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title="Purchase Bills"
        subtitle="Vendor se aayi bills"
        isMobile={isMobile}
        action={
          !isMobile && (
            <GradientButton onClick={() => router.push("/purchases/new")}>
              + Record Purchase
            </GradientButton>
          )
        }
      />

      <div style={{ padding: isMobile ? "0 14px" : "0 28px", maxWidth: 1440, margin: "0 auto" }}>
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
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--hk-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🛒</div>
            <p style={{ fontWeight: 700, fontSize: TYPE.h2, color: "var(--hk-text)", marginBottom: 8, fontFamily: SG }}>
              {search || statusFilter !== "ALL" ? "Koi purchase nahi mila" : "Abhi tak koi purchase nahi"}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || statusFilter !== "ALL" ? "Search badlo ya naya purchase record karo" : "Pehla purchase record karke shuru karo"}
            </p>
            {!search && statusFilter === "ALL" && (
              <GradientButton onClick={() => router.push("/purchases/new")}>
                + Record Purchase
              </GradientButton>
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
                      background: "var(--hk-badge)",
                      border: "1px solid var(--hk-border)",
                      marginBottom: 10,
                      cursor: "pointer",
                      fontFamily: SG,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 700, color: "var(--hk-sub)", fontFamily: IN }}>
                        {fmtFull(group.total)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)" }}>
                        · {group.bills.length} bills
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--hk-sub)" strokeWidth="1.8" strokeLinecap="round"
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
                          onClick={() => router.push(`/bills/${bill.id}`)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "16px 0",
                            borderBottom: i < group.bills.length - 1 ? "1px solid var(--hk-border)" : "none",
                            cursor: "pointer",
                            minHeight: 64,
                          }}
                        >
                          <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                                background: bill.status === "FINAL" ? GR + "18" : bill.status === "DRAFT" ? AM + "18" : OR + "18",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                stroke={bill.status === "FINAL" ? GR : bill.status === "DRAFT" ? AM : OR}
                                strokeWidth="2" strokeLinecap="round"
                              >
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                              </svg>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--hk-sub)", fontFamily: IN }}>
                                  {bill.billNumber}
                                </span>
                                <StatusChip status={bill.status} />
                              </div>
                              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", marginBottom: 3, fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {bill.party?.name || bill.customerName}
                              </p>
                              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)", fontFamily: SG }}>
                                {new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN, whiteSpace: "nowrap" }}>
                              {fmtFull(bill.grandTotal)}
                            </p>
                            <svg style={{ color: "var(--hk-sub)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                <Pagination total={totalPages} page={page} onChange={setPage} showControls />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
