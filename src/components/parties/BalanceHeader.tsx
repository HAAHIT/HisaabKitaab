"use client";

import { Button, Chip } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { type SupportedPartyType } from "@/lib/accounting";

interface BalanceHeaderProps {
  partyName: string;
  partyType: SupportedPartyType;
  currentBalance: number;
  partyPhone: string | null;
}

function formatAbsCurrency(value: number) {
  const v = Math.round(value * 100) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(v));

  if (v === 0) return formatted;
  return `+${formatted}`;
}

function getBalanceLabel(
  partyType: SupportedPartyType,
  balance: number,
  t: (key: "khata.settled" | "khata.advance" | "khata.toReceive" | "khata.toPay") => string
) {
  if (balance === 0) {
    return t("khata.settled");
  }

  if (balance > 0) {
    return t("khata.advance");
  }

  return partyType === "CUSTOMER" ? t("khata.toReceive") : t("khata.toPay");
}

/**
 * Maps the raw stored balance to a display color based on semantic meaning:
 * - "to receive" (customer, balance < 0) → success (green) — money coming in
 * - "to pay"     (vendor, balance < 0)   → danger  (red)  — money going out
 * - "advance"    (balance > 0)            → warning        — overpayment / credit on account
 * - settled      (balance = 0)            → default
 */
function getBalanceColor(partyType: SupportedPartyType, balance: number) {
  const v = Math.round(balance * 100) / 100;
  if (v === 0) return "text-default-400";
  if (v > 0) return "text-warning";
  return partyType === "CUSTOMER" ? "text-success" : "text-danger";
}

export default function BalanceHeader({
  partyName,
  partyType,
  currentBalance,
  partyPhone,
}: BalanceHeaderProps) {
  const { t } = useLanguage();
  const roundedBalance = Math.round(currentBalance * 100) / 100;
  const balanceLabel = getBalanceLabel(partyType, roundedBalance, t);

  return (
    <div className="sticky top-14 z-30 rounded-3xl border border-divider bg-background/90 p-5 shadow-lg shadow-default-200/40 backdrop-blur-lg lg:top-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{partyName}</h2>
            <Chip
              size="sm"
              color={partyType === "CUSTOMER" ? "primary" : "secondary"}
              variant="flat"
            >
              {partyType}
            </Chip>
          </div>
          <p className="text-sm text-default-500">{t("khata.ledgerSubtitle")}</p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-default-400">
              {t("khata.currentBalance")}
            </p>
            <p className={`text-3xl font-black ${getBalanceColor(partyType, roundedBalance)}`}>
              {formatAbsCurrency(roundedBalance)}
            </p>
            <p className="text-sm text-default-500">{balanceLabel}</p>
          </div>

          {partyPhone ? (
            <Button
              as="a"
              href={`tel:${partyPhone}`}
              size="sm"
              variant="flat"
              color="primary"
            >
              {t("khata.call")} +91 {partyPhone}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
