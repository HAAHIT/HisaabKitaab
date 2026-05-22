"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKPagination } from "@/components/ui/HKPagination";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import { EditPaymentModal, type EditablePayment } from "./EditPaymentModal";
import {
  C, OR, PU, GR, AM, SG, IN, TYPE, DISPLAY,
  fmtFull, useIsMobile,
  HKCard, HKToast, HKAvatar, SearchBox, PillFilter,
  PageHeader, HKModal,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

interface Payment {
  id: string;
  partyId: string | null;
  accountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  direction: string;
  mode: string;
  status: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string } | null;
  linkedBill: { id: string; billNumber: string } | null;
  BankAccount_Payment_accountIdToBankAccount?: { name: string; type: string } | null;
  BankAccount_Payment_destinationAccountIdToBankAccount?: { name: string; type: string } | null;
}

/**
 * The counter-ledger for a payment — what shows up in the "to/from" cell.
 *   1. Party (customer/vendor/expense/income) — most payments
 *   2. Destination bank — for contra (bank-to-bank) transfers
 *   3. Source bank — last-resort fallback (untyped/legacy data)
 */
function counterLedgerLabel(p: Payment): string {
  if (p.party?.name) return p.party.name;
  const dest = p.BankAccount_Payment_destinationAccountIdToBankAccount?.name;
  if (dest) return `→ ${dest}`;
  const src = p.BankAccount_Payment_accountIdToBankAccount?.name;
  if (src) return src;
  return "—";
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

function modeLabel(mode: string, t: any): string {
  const m = mode.toUpperCase();
  if (m === "UPI") return "UPI";
  if (m === "NEFT") return "NEFT";
  if (m === "CASH") return t("payments.record.mode.cash" as TranslationKey);
  if (m === "CHEQUE") return t("payments.record.mode.cheque" as TranslationKey);
  if (m === "BANK_TRANSFER") return t("payments.record.mode.bank" as TranslationKey);
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
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    // Only completed payments in month groups — pending are pinned separately
    for (const payment of payments.filter((p) => p.status !== "EXPECTED")) {
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

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/payments/${paymentToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      showToast(t("payments.deleteSuccess" as TranslationKey), "success");
      setIsDeleteModalOpen(false);
      setPaymentToDelete(null);
      await fetchPayments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("payments.deleteFailed" as TranslationKey), "error");
    } finally {
      setIsDeleting(false);
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
    { key: "ALL" as const, label: t("payments.filter.allTypes" as TranslationKey) },
    { key: "INCOMING" as const, label: t("payments.filter.received" as TranslationKey) },
    { key: "OUTGOING" as const, label: t("payments.filter.paid" as TranslationKey) },
  ];

  const statusFilterOptions = [
    { key: "ALL" as const, label: t("payments.filter.allStatus" as TranslationKey) },
    { key: "COMPLETED" as const, label: t("payments.filter.completed" as TranslationKey) },
    { key: "EXPECTED" as const, label: t("payments.filter.expected" as TranslationKey) },
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
          title={t("payments.title" as TranslationKey)}
          subtitle={t("payments.subtitle" as TranslationKey)}
          isMobile={isMobile}
          action={
            <HKButton variant="success" onClick={() => router.push("/payments/new")}>
              + {t("payments.record" as TranslationKey)}
            </HKButton>
          }
        />

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
            { l: t("payments.receivedMonth" as TranslationKey),  v: totalIn,  c: GR,         bg: C.positiveSoft, sub: t("payments.receivedSub" as TranslationKey) },
            { l: t("payments.paidMonth" as TranslationKey), v: totalOut, c: C.negative, bg: C.negativeSoft, sub: t("payments.paidSub" as TranslationKey) },
            { l: t("payments.netCashFlow" as TranslationKey),  v: net,      c: net >= 0 ? GR : C.negative, bg: net >= 0 ? C.positiveSoft : C.negativeSoft, sub: t("payments.netSub" as TranslationKey) },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "16px 18px",
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
                  color: "var(--sb-text)",
                  fontFamily: IN,
                  lineHeight: 1.1,
                }}
              >
                {fmtFull(item.v)}
              </p>
              <p style={{ fontSize: TYPE.caption, fontWeight: 600, color: "var(--sb-sub)", marginTop: 6, fontFamily: SG }}>
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
          <SearchBox value={search} onChange={setSearch} placeholder={t("payments.searchPlaceholder" as TranslationKey)} />
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
              <HKSkeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--sb-sub)" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>💸</div>
            <p
              style={{
                fontWeight: 700,
                fontSize: TYPE.h2,
                color: "var(--sb-text)",
                marginBottom: 8,
                fontFamily: SG,
              }}
            >
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? t("payments.emptyFiltered" as TranslationKey)
                : t("payments.noPayments" as TranslationKey)}
            </p>
            <p style={{ fontSize: TYPE.body, fontWeight: 500, fontFamily: SG, marginBottom: 20 }}>
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? t("payments.filtersChangeOrAdd" as TranslationKey)
                : t("payments.firstPaymentStart" as TranslationKey)}
            </p>
            <HKButton variant="success" onClick={() => router.push("/payments/new")}>
              + {t("payments.record" as TranslationKey)}
            </HKButton>
          </div>
        ) : (
          <>
            {/* §5.4: Pinned pending payments section */}
            {pendingPayments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                }}>
                  <div style={{ width: 3, height: 18, borderRadius: 2, background: AM, flexShrink: 0 }} />
                  <h2 style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                    {t("payments.actionRequired" as TranslationKey)}
                  </h2>
                  <span style={{
                    padding: "3px 10px", borderRadius: 8,
                    background: C.warningSoft, color: AM,
                    fontSize: TYPE.caption, fontWeight: 700, fontFamily: IN,
                  }}>
                    {pendingPayments.length} {t("payments.pendingLabel" as TranslationKey)}
                  </span>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid var(--sb-border)", overflow: "hidden", background: "var(--sb-card)" }}>
                  {pendingPayments.map((p, i) => {
                    const isIn = p.direction === "INCOMING";
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "14px 18px",
                          borderBottom: i < pendingPayments.length - 1 ? "1px solid var(--sb-border)" : undefined,
                          borderLeft: `3px solid ${AM}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          background: "transparent",
                        }}
                      >
                        <HKAvatar name={counterLedgerLabel(p)} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, lineHeight: 1.3 }}>
                            {counterLedgerLabel(p)}
                          </p>
                          <p style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>
                            {isIn ? t("payments.incomingAction" as TranslationKey) : t("payments.outgoingAction" as TranslationKey)} • {modeLabel(p.mode, t)}
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
                            background: C.positiveSoft,
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
                          {markingId === p.id ? "..." : `✓ ${t("payments.doneStatus" as TranslationKey)}`}
                        </button>
                        <button
                          onClick={() => { setPaymentToEdit(p); setIsEditModalOpen(true); }}
                          style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--sb-border)", background: "var(--sb-surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                          title={t("common.edit" as TranslationKey)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          onClick={() => { setPaymentToDelete(p); setIsDeleteModalOpen(true); }}
                          style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.negative}33`, background: C.negativeSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                          title={t("common.delete" as TranslationKey)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.negative} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* §5.4: "Hua Hai" section label — only when pending also visible */}
            {pendingPayments.length > 0 && monthlyPaymentGroups.length > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 3, height: 18, borderRadius: 2, background: "var(--sb-border-strong)", flexShrink: 0 }} />
                  <h2 style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                    {t("payments.completedSection" as TranslationKey)}
                  </h2>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {typeFilterOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setTypeFilter(opt.key); setPage(1); }}
                      style={{
                        padding: "5px 13px",
                        borderRadius: 20,
                        border: typeFilter === opt.key ? `1px solid ${C.primary}` : "1px solid var(--sb-border)",
                        background: typeFilter === opt.key ? C.primarySoft : "var(--sb-surface-alt)",
                        color: typeFilter === opt.key ? C.primary : "var(--sb-sub)",
                        fontSize: TYPE.bodySmall,
                        fontWeight: 700,
                        fontFamily: SG,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
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
                      background: "var(--sb-surface-alt)",
                      border: "1px solid var(--sb-border)",
                      marginBottom: 10,
                      cursor: "pointer",
                      fontFamily: SG,
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)" }}>
                      {group.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: GR, fontFamily: IN }}>
                        +{fmtFull(group.incomingTotal)}
                      </span>
                      <span style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: C.negative, fontFamily: IN }}>
                        -{fmtFull(group.outgoingTotal)}
                      </span>
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 500, color: "var(--sb-sub)" }}>
                        · {group.payments.length}
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
                    <HKCard style={{ padding: "0 16px" }}>
                      {group.payments.map((p, i) => {
                        const isIncoming = p.direction === "INCOMING";
                        const isExpected = p.status === "EXPECTED";
                        const dirColor = isIncoming ? GR : C.negative;
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
                                  ? "1px solid var(--sb-border)"
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
                                background: isIncoming ? C.positiveSoft : C.negativeSoft,
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
                                      color: "var(--sb-text)",
                                      marginBottom: 5,
                                      fontFamily: SG,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {counterLedgerLabel(p)}
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
                                      {modeLabel(p.mode, t)}
                                    </span>
                                    {isExpected && (
                                      <span
                                        style={{
                                          fontSize: TYPE.chip,
                                          fontWeight: 700,
                                          color: AM,
                                          background: C.warningSoft,
                                          padding: "3px 9px",
                                          borderRadius: 6,
                                          fontFamily: SG,
                                        }}
                                      >
                                        {isIncoming ? t("payments.incomingAction" as TranslationKey) : t("payments.outgoingAction" as TranslationKey)}
                                      </span>
                                    )}
                                    <span
                                      style={{
                                        fontSize: TYPE.bodySmall,
                                        fontWeight: 500,
                                        color: "var(--sb-sub)",
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
                                          color: "var(--sb-sub)",
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
                                          color: "var(--sb-sub)",
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
                                        background: C.positiveSoft,
                                        color: GR,
                                        fontSize: TYPE.bodySmall,
                                        fontWeight: 700,
                                        fontFamily: SG,
                                        cursor: markingId === p.id ? "wait" : "pointer",
                                        opacity: markingId === p.id ? 0.6 : 1,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {markingId === p.id ? "..." : `✓ ${t("payments.doneStatus" as TranslationKey)}`}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setPaymentToEdit(p); setIsEditModalOpen(true); }}
                                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--sb-border)", background: "var(--sb-surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                                    title={t("common.edit" as TranslationKey)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                  </button>
                                  <button
                                    onClick={() => { setPaymentToDelete(p); setIsDeleteModalOpen(true); }}
                                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.negative}33`, background: C.negativeSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                                    title={t("common.delete" as TranslationKey)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.negative} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                  </button>
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
                <HKPagination total={totalPages} page={page} onChange={setPage} showControls />
              </div>
            )}
          </>
        )}
      </div>

      <EditPaymentModal
        payment={paymentToEdit as EditablePayment | null}
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setPaymentToEdit(null); }}
        onSuccess={() => { fetchPayments(); }}
      />

      <HKModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setPaymentToDelete(null); }}
        title={t("payments.deleteTitle" as TranslationKey)}
        footer={
          <>
            <HKButton variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setPaymentToDelete(null); }} isDisabled={isDeleting}>{t("common.cancel" as TranslationKey)}</HKButton>
            <HKButton variant="danger" onClick={handleDeletePayment} isLoading={isDeleting}>{t("payments.deleteConfirm" as TranslationKey)}</HKButton>
          </>
        }
      >
        <p style={{ fontFamily: SG, fontSize: TYPE.body, color: "var(--sb-sub)", lineHeight: 1.6 }}>
          {t("payments.deleteBody" as TranslationKey)}
        </p>
      </HKModal>
    </div>
  );
}
