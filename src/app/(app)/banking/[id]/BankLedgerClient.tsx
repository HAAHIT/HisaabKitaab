"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HKModal } from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  C, OR, PU, GR, AM, SG, IN, TYPE, TOUCH, DISPLAY,
  fmtFull, useIsMobile, HKCard, HKToast,
} from "@/components/ui/hk-design";

function TrashIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
    >
      <path d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function getMonthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

type BankAccountInfo = {
  name: string;
  type: "BANK" | "CASH";
  accountNumber: string | null;
  openingBalance: number;
  currentBalance: number;
};

type LedgerEntry = {
  id: string;
  date: Date;
  direction: "INCOMING" | "OUTGOING";
  mode: string;
  amount: number;
  partyName: string;
  notes: string | null;
  increase: number;
  decrease: number;
  runningBalance: number;
};

export default function BankLedgerClient({
  accountId,
  account,
  ledger,
  role,
}: {
  accountId: string;
  account: BankAccountInfo;
  ledger: LedgerEntry[];
  role: string | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [paymentToDelete, setPaymentToDelete] = useState<LedgerEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const accountColor = account.type === "BANK" ? PU : GR;

  const monthGroups = useMemo(() => {
    const groups: Record<string, LedgerEntry[]> = {};
    for (const entry of ledger) {
      const key = getMonthKey(new Date(entry.date));
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return groups;
  }, [ledger]);

  const sortedMonthKeys = useMemo(() => Object.keys(monthGroups).sort(), [monthGroups]);
  const currentMonthKey = getMonthKey(new Date());

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    if (monthGroups[currentMonthKey]) return new Set([currentMonthKey]);
    const keys = Object.keys(monthGroups).sort();
    const lastKey = keys[keys.length - 1];
    return lastKey ? new Set([lastKey]) : new Set();
  });

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/payments/${paymentToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        onClose();
        setPaymentToDelete(null);
        showToast(t("banking.ledger.success.deleted"), "success");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("banking.ledger.error.deleted"), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const modeLabel = (mode: string) =>
    mode.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 80px" : "24px 28px 40px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <Link
            href="/banking"
            style={{
              width: TOUCH.secondary, height: TOUCH.secondary,
              borderRadius: 12, border: "1.5px solid var(--sb-border)",
              background: "var(--sb-card)", color: "var(--sb-sub)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, textDecoration: "none",
              boxShadow: "var(--sb-shadow-card)",
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 22 : 28, fontWeight: 600, color: "var(--sb-text)", letterSpacing: "-0.01em", lineHeight: 1.2, margin: 0 }}>
                {account.name}
              </h1>
              <span style={{
                fontSize: TYPE.chip, fontWeight: 700,
                color: accountColor, background: accountColor === AM ? C.warningSoft : accountColor === GR ? C.positiveSoft : C.primarySoft,
                padding: "4px 10px", borderRadius: 7, fontFamily: SG,
              }}>
                {account.type === "BANK" ? t("banking.bank") : t("banking.cash")}
              </span>
            </div>
            {account.accountNumber && (
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontWeight: 500, marginTop: 4, fontFamily: "monospace" }}>
                A/c: {account.accountNumber}
              </p>
            )}
          </div>
        </div>

        {/* Balance cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {((): { label: string; value: number; color: string; bg: string; isCount?: boolean }[] => [
            { label: t("banking.ledger.openingBalance"), value: account.openingBalance, color: AM, bg: C.warningSoft },
            { label: t("banking.ledger.currentBalance"), value: account.currentBalance, color: account.currentBalance >= 0 ? GR : C.negative, bg: account.currentBalance >= 0 ? C.positiveSoft : C.negativeSoft },
            ...(!isMobile ? [{ label: t("banking.ledger.transactions"), value: ledger.length, color: PU, bg: C.infoSoft, isCount: true }] : []),
          ])().map((item) => (
            <div
              key={item.label}
              style={{
                padding: "16px 18px", borderRadius: 16,
                background: item.bg,
                border: "1px solid var(--sb-border)",
                boxShadow: "var(--sb-shadow-card)",
              }}
            >
              <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: item.color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontFamily: SG }}>
                {item.label}
              </p>
              <p style={{ fontSize: isMobile ? TYPE.numMedium : TYPE.numMedium + 2, fontWeight: 800, color: "var(--sb-text)", fontFamily: IN, lineHeight: 1.1 }}>
                {item.isCount ? item.value : fmtFull(Number(item.value))}
              </p>
            </div>
          ))}
        </div>

        {/* Passbook */}
        <HKCard style={{ padding: 0, overflow: "hidden" }}>
          {/* Table header (desktop only) */}
          {!isMobile && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 110px 110px 120px 44px",
              gap: 0,
              padding: "12px 20px",
              borderBottom: "1px solid var(--sb-border)",
              background: "var(--sb-badge)",
            }}>
              {[
                t("banking.ledger.header.date"),
                t("banking.ledger.header.particulars"),
                t("banking.ledger.header.in"),
                t("banking.ledger.header.out"),
                t("banking.ledger.header.balance"),
                "",
              ].map((h) => (
                <p key={h} style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", textAlign: h === t("banking.ledger.header.in") || h === t("banking.ledger.header.out") || h === t("banking.ledger.header.balance") ? "right" : "left", fontFamily: SG, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</p>
              ))}
            </div>
          )}

          {/* Opening balance row */}
          {!isMobile && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 110px 110px 120px 44px",
              padding: "12px 20px",
              borderBottom: "1px solid var(--sb-border)",
              background: AM + "08",
            }}>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: IN }}>—</p>
              <p style={{ fontSize: TYPE.bodySmall, fontStyle: "italic", color: "var(--sb-sub)", fontFamily: SG }}>{t("banking.ledger.openingBalance")}</p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: GR, textAlign: "right", fontFamily: IN }}>
                {account.openingBalance > 0 ? fmtFull(account.openingBalance) : "—"}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: C.negative, textAlign: "right", fontFamily: IN }}>
                {account.openingBalance < 0 ? fmtFull(Math.abs(account.openingBalance)) : "—"}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: account.openingBalance < 0 ? C.negative : "var(--sb-text)", textAlign: "right", fontFamily: IN }}>
                {fmtFull(account.openingBalance)}
              </p>
              <div />
            </div>
          )}

          {ledger.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--sb-sub)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
              <p style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-sub)", fontFamily: SG }}>
                {t("banking.ledger.noTransactions")}
              </p>
            </div>
          )}

          {sortedMonthKeys.map((monthKey) => {
            const entries = monthGroups[monthKey];
            const isExpanded = expandedMonths.has(monthKey);
            const totalIn = entries.reduce((s, e) => s + e.increase, 0);
            const totalOut = entries.reduce((s, e) => s + e.decrease, 0);
            const closing = entries[entries.length - 1]?.runningBalance ?? 0;
            const isCurrent = monthKey === currentMonthKey;

            return (
              <React.Fragment key={monthKey}>
                {/* Month header row */}
                <div
                  onClick={() => toggleMonth(monthKey)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--sb-border)",
                    background: "var(--sb-badge)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "var(--sb-sub)" }}><ChevronIcon expanded={isExpanded} /></span>
                    <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>
                      {formatMonthLabel(monthKey)}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: TYPE.chip, fontWeight: 700, color: PU,
                        background: PU + "18", padding: "3px 8px", borderRadius: 6, fontFamily: SG,
                      }}>{t("banking.ledger.current")}</span>
                    )}
                    <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>
                      {entries.length} {entries.length === 1 ? t("banking.ledger.txn") : t("banking.ledger.txns")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 20 }}>
                    {totalIn > 0 && (
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: GR, fontFamily: IN }}>
                        +{fmtFull(totalIn)}
                      </span>
                    )}
                    {totalOut > 0 && (
                      <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: C.negative, fontFamily: IN }}>
                        −{fmtFull(totalOut)}
                      </span>
                    )}
                    <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: closing < 0 ? C.negative : "var(--sb-text)", fontFamily: IN }}>
                      {fmtFull(closing)}
                    </span>
                  </div>
                </div>

                {/* Transaction rows */}
                {isExpanded && entries.map((entry, i) => {
                  const isIn = entry.direction === "INCOMING";
                  return isMobile ? (
                    // Mobile: card-style row
                    <div
                      key={entry.id}
                      style={{
                        padding: "14px 20px",
                        borderBottom: i < entries.length - 1 ? "1px solid var(--sb-border)" : undefined,
                        display: "flex", alignItems: "center", gap: 12,
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 11,
                        background: (isIn ? GR : C.negative) + "18",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, color: isIn ? GR : C.negative,
                        fontSize: 18,
                      }}>
                        {isIn ? "↓" : "↑"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, lineHeight: 1.3 }}>
                          {entry.partyName}
                        </p>
                        <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>
                          {formatDate(entry.date)} · {modeLabel(entry.mode)}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: isIn ? GR : C.negative, fontFamily: IN }}>
                          {isIn ? "+" : "−"}{fmtFull(entry.amount)}
                        </p>
                        <p style={{ fontSize: TYPE.caption, color: entry.runningBalance < 0 ? C.negative : "var(--sb-sub)", fontFamily: IN, marginTop: 2 }}>
                          Bal: {fmtFull(entry.runningBalance)}
                        </p>
                      </div>
                      <button
                        onClick={() => { setPaymentToDelete(entry); onOpen(); }}
                        style={{
                          width: 36, height: 36, borderRadius: 9, border: "none",
                          background: "transparent", color: "var(--sb-sub)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : (
                    // Desktop: table row
                    <div
                      key={entry.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "90px 1fr 110px 110px 120px 44px",
                        padding: "12px 20px",
                        borderBottom: "1px solid var(--sb-border)",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sb-badge)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: IN }}>
                        {formatDate(entry.date)}
                      </p>
                      <div>
                        <p style={{ fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG }}>
                          {entry.partyName}
                        </p>
                        <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>
                          {modeLabel(entry.mode)}
                          {entry.notes && ` · ${entry.notes}`}
                        </p>
                      </div>
                      <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: GR, textAlign: "right", fontFamily: IN }}>
                        {entry.increase > 0 ? fmtFull(entry.increase) : "—"}
                      </p>
                      <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: C.negative, textAlign: "right", fontFamily: IN }}>
                        {entry.decrease > 0 ? fmtFull(entry.decrease) : "—"}
                      </p>
                      <p style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: entry.runningBalance < 0 ? C.negative : "var(--sb-text)", textAlign: "right", fontFamily: IN }}>
                        {fmtFull(entry.runningBalance)}
                      </p>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => { setPaymentToDelete(entry); onOpen(); }}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: "none",
                            background: "transparent", color: "var(--sb-sub)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.negative + "15"; (e.currentTarget as HTMLButtonElement).style.color = C.negative; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--sb-sub)"; }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </HKCard>
      </div>

      {/* Delete confirmation */}
      <HKModal
        isOpen={isOpen}
        onClose={onClose}
        title={t("banking.ledger.deleteModal.title")}
        footer={
          <>
            <HKButton variant="secondary" isDisabled={isDeleting} onClick={onClose}>{t("common.cancel")}</HKButton>
            <HKButton variant="danger" isLoading={isDeleting} onClick={handleDeletePayment}>
              {t("banking.ledger.deleteModal.confirm")}
            </HKButton>
          </>
        }
      >
        <p style={{ fontFamily: SG, fontSize: TYPE.body, color: "var(--sb-sub)" }}>
          {paymentToDelete && (
            <>
              <span style={{ fontWeight: 700, color: paymentToDelete.direction === "INCOMING" ? GR : C.negative }}>
                {paymentToDelete.direction === "INCOMING" ? "+" : "−"}{fmtFull(paymentToDelete.amount)}
              </span>
              {" "}— {paymentToDelete.partyName} {t("banking.ledger.deleteModal.body")}
            </>
          )}
        </p>
      </HKModal>
    </div>
  );
}
