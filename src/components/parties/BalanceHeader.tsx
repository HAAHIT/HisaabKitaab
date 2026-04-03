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

function formatSignedCurrency(value: number) {
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(absolute);

  if (value === 0) {
    return formatted;
  }

  return `${value > 0 ? "+" : "-"}${formatted}`;
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

export default function BalanceHeader({
  partyName,
  partyType,
  currentBalance,
  partyPhone,
}: BalanceHeaderProps) {
  const { t } = useLanguage();
  const balanceLabel = getBalanceLabel(partyType, currentBalance, t);

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
            <p
              className={`text-3xl font-black ${
                currentBalance > 0
                  ? "text-success"
                  : currentBalance < 0
                    ? "text-danger"
                    : "text-default-900"
              }`}
            >
              {formatSignedCurrency(currentBalance)}
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
