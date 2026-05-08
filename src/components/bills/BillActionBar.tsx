"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface BillActionBarProps {
  bill: {
    id: string;
    billNumber: string;
    customerName: string;
    grandTotal: number;
    status: string;
    customerPhone?: string | null;
    partyId?: string | null;
  };
  onShare?: () => void | Promise<void>;
}

export function BillActionBar({ bill, onShare }: BillActionBarProps) {
  const { t } = useLanguage();
  const router = useRouter();

  function handleShare() {
    onShare?.();
  }

  function handlePrint() {
    window.print();
  }

  function handlePayment() {
    const nextUrl = `/payments/new?billId=${bill.id}${
      bill.partyId ? `&partyId=${bill.partyId}` : ""
    }`;
    router.push(nextUrl);
  }

  return (
    <div className="no-print pointer-events-none fixed bottom-[80px] left-0 right-0 z-40 px-4 md:bottom-8">
      <div className="pointer-events-auto mx-auto max-w-2xl">
        <div className="flex items-center justify-around gap-2 rounded-2xl border border-divider bg-background/90 p-2 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] backdrop-blur-md dark:shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.8)]">
          {bill.status !== "DRAFT" && (
            <Button
              variant="flat"
              color="primary"
              className="flex-1 font-medium"
              onPress={handleShare}
            >
              {t("common.share")}
            </Button>
          )}

          <Button
            variant="flat"
            color="default"
            className="flex-1 bg-default-100 font-medium"
            onPress={handlePrint}
          >
            {t("common.print")}
          </Button>

          {bill.status !== "CANCELLED" && (
            <Button
              variant="solid"
              color="success"
              className="flex-1 px-1 font-medium text-white shadow-md shadow-success/20"
              onPress={handlePayment}
            >
              {t("payments.record")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
