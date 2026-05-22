"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKPagination } from "@/components/ui/HKPagination";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  C, OR, GR, AM, SG, IN, TYPE,
  fmtFull, useIsMobile,
  HKCard, StatusChip, HKAvatar, HKToast, SearchBox, PillFilter,
  PageHeader,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { OverdueBanner } from "@/components/ui/OverdueBanner";
import { useOverdueData } from "@/hooks/useOverdueData";

type DatePreset = "ALL" | "THIS_MONTH" | "LAST_MONTH" | "LAST_3M" | "CUSTOM";

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "THIS_MONTH") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (preset === "LAST_MONTH") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (preset === "LAST_3M") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  return null;
}

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

export default function BillsListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const overdue = useOverdueData();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "FINAL" | "CANCELLED">("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [billSummary, setBillSummary] = useState({ kulBilled: 0, mila: 0, baaki: 0 });

  const monthlyBillGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<string, { label: string; bills: Bill[]; total: number }>();
    for (const bill of bills) {
      const d = new Date(bill.date ?? bill.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.bills.push(bill);
        existing.total += Number(bill.grandTotal);
      } else {
        groups.set(key, {
          label: monthFormatter.format(d),
          bills: [bill],
          total: Number(bill.grandTotal),
        });
      }
    }
    return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }));
  }, [bills]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("partyType", "CUSTOMER");
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));

      // Date range — preset takes priority, custom used when CUSTOM selected
      const range = datePreset !== "CUSTOM" ? getPresetRange(datePreset) : null;
      const effectiveFrom = range ? range.from : (datePreset === "CUSTOM" ? customFrom : "");
      const effectiveTo = range ? range.to : (datePreset === "CUSTOM" ? customTo : "");
      if (effectiveFrom) params.set("from", effectiveFrom + "T00:00:00.000Z");
      if (effectiveTo) params.set("to", effectiveTo + "T23:59:59.999Z");

      const response = await fetch(`/api/bills?${params.toString()}`);
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      setBills((data.bills || []) as Bill[]);
      setTotalPages(data.totalPages || 1);
      if (data.summary) {
        setBillSummary({
          kulBilled: data.summary.kulBilled ?? 0,
          mila: data.summary.mila ?? 0,
          baaki: data.summary.baaki ?? 0,
        });
      }
    } catch (error) {
      setBills([]);
      setTotalPages(1);
      showToast(error instanceof Error ? error.message : t("bills.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, datePreset, customFrom, customTo, t]);

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
    <div
      style={{
        background: "var(--sb-bg)",
        minHeight: "100%",
        paddingBottom: 0,
        fontFamily: SG,
      }}
    >
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        <PageHeader
          title="Mere Bills"
          subtitle="Apne sab bills yahaan"
          isMobile={isMobile}
          action={
            !isMobile && (
              <HKButton onClick={() => router.push("/bills/new")}>
                + Naya Bill Banao
              </HKButton>
            )
          }
        />
        {/* Overdue banner */}
        <OverdueBanner
          overdueCount={overdue.overdueCount}
          overdueAmount={overdue.overdueAmount}
          overdueParty={overdue.overdueParty}
        />

        {/* Summary stats — ₹ amounts per PRD §5.2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(3, 1fr)`,
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[
            { l: "Kul Billed", v: fmtFull(billSummary.kulBilled), sub: "is mahine", c: "var(--sb-text)", bg: "var(--sb-card)" },
            { l: "Mila", v: fmtFull(billSummary.mila), sub: "wapas mila", c: GR, bg: C.positiveSoft },
            { l: "Baaki", v: fmtFull(billSummary.baaki), sub: "abhi tak", c: C.primary, bg: C.primarySoft },
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
              <p
                style={{
                  fontSize: TYPE.caption,
                  fontWeight: 700,
                  color: "var(--sb-sub)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 6,
                  fontFamily: SG,
                }}
              >
                {item.l}
              </p>
              <p style={{ fontSize: isMobile ? TYPE.numSmall : TYPE.numLarge, fontWeight: 800, color: item.c, fontFamily: IN, lineHeight: 1 }}>
                {item.v}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", marginTop: 4, fontFamily: SG }}>{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Date range filter */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: datePreset === "CUSTOM" ? 8 : 0 }}>
            {(
              [
                { key: "ALL" as DatePreset, label: "Sab Time" },
                { key: "THIS_MONTH" as DatePreset, label: "Is Mahine" },
                { key: "LAST_MONTH" as DatePreset, label: "Pichle Mahine" },
                { key: "LAST_3M" as DatePreset, label: "Teen Mahine" },
                { key: "CUSTOM" as DatePreset, label: "Custom" },
              ] as { key: DatePreset; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setDatePreset(opt.key); setPage(1); }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1.5px solid",
                  borderColor: datePreset === opt.key ? "var(--sb-primary)" : "var(--sb-border)",
                  background: datePreset === opt.key ? "var(--sb-primary)" : "var(--sb-card)",
                  color: datePreset === opt.key ? "#fff" : "var(--sb-sub)",
                  fontSize: TYPE.bodySmall,
                  fontWeight: 600,
                  fontFamily: SG,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {datePreset === "CUSTOM" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-card)",
                  color: "var(--sb-text)",
                  fontSize: TYPE.bodySmall,
                  fontFamily: SG,
                  cursor: "pointer",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>se</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-card)",
                  color: "var(--sb-text)",
                  fontSize: TYPE.bodySmall,
                  fontFamily: SG,
                  cursor: "pointer",
                  outline: "none",
                }}
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(""); setCustomTo(""); setPage(1); }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 10,
                    border: "1.5px solid var(--sb-border)",
                    background: "transparent",
                    color: "var(--sb-sub)",
                    fontSize: TYPE.bodySmall,
                    fontFamily: SG,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Bill number, party ya customer dhundho..." />
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
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--sb-sub)",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
            <p
              style={{
                fontWeight: 700,
                fontSize: TYPE.h2,
                color: "var(--sb-text)",
                marginBottom: 8,
                fontFamily: SG,
              }}
            >
              {search || statusFilter !== "ALL" ? "Koi bill nahi mila" : "Abhi tak koi bill nahi"}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || statusFilter !== "ALL" ? "Search badlo ya naya bill banao" : "Pehla bill banakar shuru karo"}
            </p>
            {!search && statusFilter === "ALL" && (
              <HKButton onClick={() => router.push("/bills/new")}>
                + Naya Bill Banao
              </HKButton>
            )}
          </div>
        ) : (
          <>
            {/* Bill groups by month */}
            {monthlyBillGroups.map((group) => {
              const isCollapsed = collapsedMonths[group.key] === true;
              return (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  {/* Month header */}
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
                      background: "var(--sb-surface-alt)",
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
                      <span
                        style={{
                          fontSize: TYPE.numSmall,
                          fontWeight: 700,
                          color: "var(--sb-sub)",
                          fontFamily: IN,
                        }}
                      >
                        {fmtFull(group.total)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)" }}>
                        · {group.bills.length} bills
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--sb-sub)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        style={{
                          transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <HKCard style={{ padding: 0 }}>
                      {group.bills.map((bill, i) => {
                        const partyName = bill.party?.name || bill.customerName;
                        return (
                          <button
                            key={bill.id}
                            onClick={() => router.push(`/bills/${bill.id}`)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "14px 18px",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              borderBottom: i < group.bills.length - 1 ? "1px solid var(--sb-divider)" : "none",
                              textAlign: "left",
                              color: "var(--sb-text)",
                              transition: "background 0.15s",
                              fontFamily: SG,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <HKAvatar name={partyName || "—"} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG }}>{partyName}</span>
                                <StatusChip status={bill.status} />
                              </div>
                              <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: 0, fontFamily: SG }}>
                                {bill.billNumber} · {new Date(bill.date ?? bill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontSize: TYPE.numSm, fontWeight: 700, color: "var(--sb-text)", margin: 0, fontFamily: IN, fontVariantNumeric: "tabular-nums" }}>
                                {fmtFull(bill.grandTotal)}
                              </p>
                            </div>
                            <svg style={{ color: "var(--sb-muted)", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m9 18 6-6-6-6"/>
                            </svg>
                          </button>
                        );
                      })}
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
