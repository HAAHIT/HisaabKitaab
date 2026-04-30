"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination, Skeleton } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  OR, PU, GR, AM, SG, IN, TYPE,
  fmt, fmtFull, useIsMobile,
  HKCard, HKToast, SearchBox, PillFilter,
  PageHeader, GradientButton,
} from "@/components/ui/hk-design";

interface Payment {
  id: string;
  amount: number;
  direction: string;
  mode: string;
  status: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string };
  linkedBill: { id: string; billNumber: string } | null;
}

const MODE_COLOR: Record<string, string> = {
  UPI: PU,
  NEFT: GR,
  CASH: AM,
  CHEQUE: OR,
  BANK_TRANSFER: GR,
  CARD: PU,
};

function modeColor(mode: string): string {
  return MODE_COLOR[mode.toUpperCase()] || PU;
}

function modeLabel(mode: string): string {
  return mode
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function PaymentsListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOMING" | "OUTGOING">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "EXPECTED">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const monthlyPaymentGroups = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<
      string,
      { label: string; payments: Payment[]; incomingTotal: number; outgoingTotal: number }
    >();
    for (const payment of payments) {
      const d = new Date(payment.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = groups.get(key);
      const isIn = payment.direction === "INCOMING";
      if (existing) {
        existing.payments.push(payment);
        if (isIn) existing.incomingTotal += Number(payment.amount);
        else existing.outgoingTotal += Number(payment.amount);
      } else {
        groups.set(key, {
          label: monthFormatter.format(d),
          payments: [payment],
          incomingTotal: isIn ? Number(payment.amount) : 0,
          outgoingTotal: isIn ? 0 : Number(payment.amount),
        });
      }
    }
    return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }));
  }, [payments]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));

      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) throw new Error(await readError(response));

      const data = await response.json();
      setPayments((data.payments || []) as Payment[]);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setPayments([]);
      setTotalPages(1);
      showToast(error instanceof Error ? error.message : t("payments.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, t, typeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function markAsCompleted(paymentId: string) {
    setMarkingId(paymentId);
    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      if (!response.ok) throw new Error(await readError(response));
      showToast(t("payments.markCompletedSuccess"), "success");
      await fetchPayments();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("payments.markCompletedFailed"),
        "error"
      );
    } finally {
      setMarkingId(null);
    }
  }

  // Summary totals
  const totalIn = payments
    .filter((p) => p.direction === "INCOMING" && p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = payments
    .filter((p) => p.direction === "OUTGOING" && p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);
  const net = totalIn - totalOut;

  // §5.4: Pending payments pinned to top
  const pendingPayments = payments.filter((p) => p.status === "EXPECTED");
  const completedPayments = payments.filter((p) => p.status !== "EXPECTED");

  const typeFilterOptions = [
    { key: "ALL" as const, label: "Sab" },
    { key: "INCOMING" as const, label: "Mila" },
    { key: "OUTGOING" as const, label: "Diya" },
  ];

  const statusFilterOptions = [
    { key: "ALL" as const, label: "Sab" },
    { key: "COMPLETED" as const, label: "Done" },
    { key: "EXPECTED" as const, label: "Pending" },
  ];

  return (
    <div
      style={{
        background: "var(--hk-bg)",
        minHeight: "100%",
        paddingBottom: 0,
        fontFamily: SG,
      }}
    >
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title="Payments"
        subtitle="Aana-jaana sab yahaan"
        isMobile={isMobile}
        action={
          <GradientButton variant="green" onClick={() => router.push("/payments/new")}>
            + Payment Likho
          </GradientButton>
        }
      />

      <div style={{ padding: isMobile ? "0 14px" : "0 28px", maxWidth: 1440, margin: "0 auto" }}>
        {/* Summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[
            { l: "Mila ↓", v: totalIn, c: GR, sub: "received" },
            { l: "Diya ↑", v: totalOut, c: OR, sub: "paid out" },
            { l: "Net", v: net, c: PU, sub: "this period" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                background: item.c + "14",
                border: `1px solid ${item.c}25`,
              }}
            >
              <p
                style={{
                  fontSize: TYPE.caption,
                  fontWeight: 700,
                  color: item.c,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 6,
                  fontFamily: SG,
                }}
              >
                {item.l}
              </p>
              <p
                style={{
                  fontSize: isMobile ? TYPE.numMedium + 2 : TYPE.numLarge - 4,
                  fontWeight: 800,
                  color: "var(--hk-text)",
                  fontFamily: IN,
                  lineHeight: 1.1,
                }}
              >
                {fmt(item.v)}
              </p>
              <p style={{ fontSize: TYPE.caption, fontWeight: 600, color: "var(--hk-sub)", marginTop: 6, fontFamily: SG }}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <SearchBox value={search} onChange={setSearch} placeholder="Payment dhundho..." />
          <PillFilter
            options={typeFilterOptions}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
          />
          <PillFilter
            options={statusFilterOptions}
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
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--hk-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>💸</div>
            <p
              style={{
                fontWeight: 700,
                fontSize: TYPE.h2,
                color: "var(--hk-text)",
                marginBottom: 8,
                fontFamily: SG,
              }}
            >
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "Koi payment nahi mili"
                : "Abhi tak koi payment nahi"}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "Filters badlo ya nayi payment likho"
                : "Pehli payment record karo"}
            </p>
            <GradientButton variant="green" onClick={() => router.push("/payments/new")}>
              + Payment Likho
            </GradientButton>
          </div>
        ) : (
          <>
            {/* §5.4: Pinned pending payments section */}
            {pendingPayments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                }}>
                  <h2 style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: AM, fontFamily: SG }}>
                    🔔 Action Chahiye
                  </h2>
                  <span style={{
                    padding: "3px 10px", borderRadius: 8,
                    background: AM + "20", color: AM,
                    fontSize: TYPE.caption, fontWeight: 700, fontFamily: IN,
                  }}>
                    {pendingPayments.length}
                  </span>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid var(--hk-border)", overflow: "hidden", background: "var(--hk-card)" }}>
                  {pendingPayments.map((p, i) => {
                    const isIn = p.direction === "INCOMING";
                    const mc = modeColor(p.mode);
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "14px 18px",
                          borderBottom: i < pendingPayments.length - 1 ? "1px solid var(--hk-border)" : undefined,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          background: AM + "06",
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 11,
                          background: AM + "18",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 18 }}>{isIn ? "↓" : "↑"}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, lineHeight: 1.3 }}>
                            {p.party.name}
                          </p>
                          <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)", fontFamily: SG, marginTop: 2 }}>
                            {isIn ? "Milega" : "Dena hai"} • {modeLabel(p.mode)}
                          </p>
                        </div>
                        <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: AM, fontFamily: IN, whiteSpace: "nowrap" }}>
                          {fmtFull(Number(p.amount))}
                        </span>
                        <button
                          onClick={() => markAsCompleted(p.id)}
                          disabled={markingId === p.id}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 10,
                            background: GR + "18",
                            border: `1px solid ${GR}33`,
                            color: GR,
                            fontSize: TYPE.bodySmall,
                            fontWeight: 700,
                            fontFamily: SG,
                            cursor: markingId === p.id ? "wait" : "pointer",
                            opacity: markingId === p.id ? 0.6 : 1,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {markingId === p.id ? "..." : "✓ Done"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed payments — month grouped */}
            {monthlyPaymentGroups.map((group) => {
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
                      background: "var(--hk-badge)",
                      border: "1px solid var(--hk-border)",
                      marginBottom: 10,
                      cursor: "pointer",
                      fontFamily: SG,
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: GR, fontFamily: IN }}>
                        +{fmtFull(group.incomingTotal)}
                      </span>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: OR, fontFamily: IN }}>
                        -{fmtFull(group.outgoingTotal)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--hk-sub)" }}>
                        · {group.payments.length}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--hk-sub)"
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
                    <HKCard style={{ padding: "0 16px" }}>
                      {group.payments.map((p, i) => {
                        const isIncoming = p.direction === "INCOMING";
                        const isExpected = p.status === "EXPECTED";
                        const dirColor = isIncoming ? GR : OR;
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                              padding: "16px 0",
                              borderBottom:
                                i < group.payments.length - 1
                                  ? "1px solid var(--hk-border)"
                                  : "none",
                              borderLeft: isExpected ? `4px solid ${AM}` : "none",
                              paddingLeft: isExpected ? 12 : 0,
                              marginLeft: isExpected ? -12 : 0,
                              minHeight: 64,
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: dirColor + "18",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={dirColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              >
                                {isIncoming ? (
                                  <>
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                  </>
                                ) : (
                                  <>
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <polyline points="19 12 12 19 5 12" />
                                  </>
                                )}
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 12,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p
                                    style={{
                                      fontSize: TYPE.bodyLarge,
                                      fontWeight: 700,
                                      color: "var(--hk-text)",
                                      marginBottom: 5,
                                      fontFamily: SG,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {p.party.name}
                                  </p>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: TYPE.chip,
                                        fontWeight: 700,
                                        color: modeColor(p.mode),
                                        background: modeColor(p.mode) + "18",
                                        padding: "3px 9px",
                                        borderRadius: 6,
                                        fontFamily: SG,
                                      }}
                                    >
                                      {modeLabel(p.mode)}
                                    </span>
                                    {isExpected && (
                                      <span
                                        style={{
                                          fontSize: TYPE.chip,
                                          fontWeight: 700,
                                          color: AM,
                                          background: AM + "22",
                                          padding: "3px 9px",
                                          borderRadius: 6,
                                          fontFamily: SG,
                                        }}
                                      >
                                        {isIncoming ? "Aana Hai" : "Dena Hai"}
                                      </span>
                                    )}
                                    <span
                                      style={{
                                        fontSize: TYPE.bodySmall,
                                        fontWeight: 500,
                                        color: "var(--hk-sub)",
                                        fontFamily: SG,
                                      }}
                                    >
                                      {new Date(p.date).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                    {p.linkedBill && (
                                      <span
                                        style={{
                                          fontSize: TYPE.bodySmall,
                                          fontWeight: 500,
                                          color: "var(--hk-sub)",
                                          fontFamily: IN,
                                        }}
                                      >
                                        · {p.linkedBill.billNumber}
                                      </span>
                                    )}
                                    {p.notes && (
                                      <span
                                        style={{
                                          fontSize: TYPE.bodySmall,
                                          fontWeight: 500,
                                          color: "var(--hk-sub)",
                                          fontFamily: SG,
                                          maxWidth: 200,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        · {p.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    flexShrink: 0,
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: TYPE.numMedium,
                                      fontWeight: 800,
                                      color: dirColor,
                                      fontFamily: IN,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {isIncoming ? "+" : "-"}
                                    {fmtFull(p.amount)}
                                  </p>
                                  {isExpected && (
                                    <button
                                      onClick={() => markAsCompleted(p.id)}
                                      disabled={markingId === p.id}
                                      style={{
                                        minHeight: 40,
                                        padding: "0 14px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: GR + "22",
                                        color: GR,
                                        fontSize: TYPE.bodySmall,
                                        fontWeight: 700,
                                        fontFamily: SG,
                                        cursor: markingId === p.id ? "wait" : "pointer",
                                        opacity: markingId === p.id ? 0.6 : 1,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {markingId === p.id ? "..." : "✓ Done"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
