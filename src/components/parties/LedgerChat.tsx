"use client";

import Link from "next/link";
import { HKChip } from "@/components/ui/HKChip";
import { HKButton } from "@/components/ui/HKButton";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatBalance(value: number, partyType: SupportedPartyType) {
  const indicator = getBalanceIndicator(partyType, value);
  if (!indicator) {
    return "INR 0";
  }

  return `${formatCurrency(value)} (${indicator})`;
}

function getEntryTone(entry: PartyLedgerEntry) {
  if (entry.type === "OPENING") {
    return "default";
  }

  return entry.debit > 0 ? "danger" : "success";
}

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
          <HKChip variant="flat" color={currentBalance >= 0 ? "success" : "danger"}>
            {formatBalance(currentBalance, partyType)}
          </HKChip>
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
        <HKButton
          className="flex-1"
          variant="secondary"
          onClick={() => router.push(`/bills/new?partyId=${partyId}`)}
        >
          {t("bills.new")}
        </HKButton>
        <HKButton
          className="flex-1"
          variant="success"
          onClick={() => router.push(`/payments/new?partyId=${partyId}`)}
        >
          {t("payments.record")}
        </HKButton>
      </div>
    </div>
  );
}
