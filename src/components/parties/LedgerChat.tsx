"use client";

import Link from "next/link";
import { Button, Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getBalanceIndicator,
  type PartyLedgerEntry,
  type SupportedPartyType,
} from "@/lib/accounting";

interface LedgerChatProps {
  partyId: string;
  partyName: string;
  partyType: SupportedPartyType;
  partyPhone: string | null;
  currentBalance: number;
  ledger: PartyLedgerEntry[];
}

/**
 * Format a numeric amount as an INR currency string.
 *
 * @param value - The numeric amount to format; the returned string represents the absolute value (magnitude) of this amount.
 * @returns The formatted INR currency string with no fractional digits (e.g., `₹1,234`)
 */
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

/**
 * Create a display string for a monetary balance that includes a balance indicator.
 *
 * @param value - Balance amount in currency units (positive for credit, negative for debit)
 * @param partyType - Party classification used to determine the balance indicator
 * @returns The absolute INR-formatted amount followed by the indicator in parentheses (e.g. `INR 1,000 (You owe)`), or `INR 0` when no indicator is available
 */
function formatBalance(value: number, partyType: SupportedPartyType) {
  const indicator = getBalanceIndicator(partyType, value);
  if (!indicator) {
    return "INR 0";
  }

  return `${formatCurrency(value)} (${indicator})`;
}

/**
 * Determine visual tone for a ledger entry.
 *
 * @param entry - The ledger entry to evaluate
 * @returns `'default'` for entries of type `"OPENING"`, `'danger'` if `entry.debit` is greater than zero, `'success'` otherwise.
 */
function getEntryTone(entry: PartyLedgerEntry) {
  if (entry.type === "OPENING") {
    return "default";
  }

  return entry.debit > 0 ? "danger" : "success";
}

/**
 * Renders a scrollable ledger UI for a party, showing current balance, ledger entries, and quick actions to create a bill or record a payment.
 *
 * @param partyId - The party's unique identifier used for navigation when creating bills or payments
 * @param partyName - The display name of the party shown in the header when phone is not available
 * @param partyType - The party category used to determine balance formatting and indicators
 * @param partyPhone - Optional phone number; when present it is shown in the header prefixed with +91
 * @param currentBalance - The party's current numeric balance used to render the balance chip
 * @param ledger - Array of ledger entries to display; each entry is rendered with date, type, description/link, balance after, and amount
 * @returns A React element that displays the party ledger, entries list, empty-state when appropriate, and sticky action buttons for new bill and record payment
 */
export default function LedgerChat({
  partyId,
  partyName,
  partyType,
  partyPhone,
  currentBalance,
  ledger,
}: LedgerChatProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="rounded-3xl border border-divider bg-default-50/60 shadow-sm">
      <div className="border-b border-divider px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{t("khata.ledgerTitle")}</h3>
            <p className="text-sm text-default-500">
              {partyPhone ? `+91 ${partyPhone}` : partyName}
            </p>
          </div>
          <Chip variant="flat" color={currentBalance >= 0 ? "success" : "danger"}>
            {formatBalance(currentBalance, partyType)}
          </Chip>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-5">
        {ledger.map((entry) => {
          const entryTone = getEntryTone(entry);
          const amount =
            entry.debit > 0
              ? `-${formatCurrency(entry.debit)}`
              : entry.credit > 0
                ? `+${formatCurrency(entry.credit)}`
                : formatCurrency(0);

          return (
            <div
              key={entry.id}
              className={`flex ${
                entry.type === "OPENING"
                  ? "justify-center"
                  : entry.debit > 0
                    ? "justify-start"
                    : "justify-end"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-3xl px-4 py-3 shadow-sm ${
                  entry.type === "OPENING"
                    ? "border border-divider bg-background"
                    : entryTone === "danger"
                      ? "bg-danger/10 text-danger-700"
                      : "bg-success/10 text-success-700"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-default-400">
                  <span>
                    {new Date(entry.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span>•</span>
                  <span>{entry.type}</span>
                </div>

                <div className="space-y-2">
                  {entry.link ? (
                    <Link href={entry.link} className="font-semibold text-primary hover:underline">
                      {entry.description}
                    </Link>
                  ) : (
                    <p className="font-semibold text-foreground">{entry.description}</p>
                  )}

                  <div className="flex items-end justify-between gap-4">
                    <div className="text-xs text-default-500">
                      {t("khata.balanceAfter")} {formatBalance(entry.balanceAfter, partyType)}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        entry.debit > 0
                          ? "text-danger"
                          : entry.credit > 0
                            ? "text-success"
                            : "text-default-700"
                      }`}
                    >
                      {amount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {ledger.length === 1 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-background px-4 py-8 text-center text-sm text-default-500">
            {t("khata.noTransactions")}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-divider bg-background/90 p-4 backdrop-blur">
        <Button
          className="flex-1"
          color="danger"
          variant="flat"
          onPress={() => router.push(`/bills/new?partyId=${partyId}`)}
        >
          {t("bills.new")}
        </Button>
        <Button
          className="flex-1"
          color="success"
          variant="flat"
          onPress={() => router.push(`/payments/new?partyId=${partyId}`)}
        >
          {t("payments.record")}
        </Button>
      </div>
    </div>
  );
}
