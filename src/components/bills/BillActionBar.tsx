"use client";

import { Button } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

interface BillActionBarProps {
  bill: {
    id: string;
    billNumber: string;
    customerName: string;
    grandTotal: number;
    status: string;
    customerPhone?: string | null;
    partyId?: string;
  };
}

export function BillActionBar({ bill }: BillActionBarProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const handleShare = () => {
    // Sharing logic goes here (Epic 5)
    alert("Sharing " + bill.billNumber);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePayment = () => {
    const defaultUrl = `/payments/new?billId=${bill.id}${bill.partyId ? `&partyId=${bill.partyId}` : ""}`;
    router.push(defaultUrl);
  };

  return (
    <div className="fixed bottom-[80px] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
      <div className="mx-auto max-w-2xl pointer-events-auto">
        <div className="bg-background/90 backdrop-blur-md shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.8)] border border-divider rounded-2xl p-2 flex items-center justify-around gap-2">
          
          {bill.status !== "DRAFT" && (
            <Button
              variant="flat"
              color="primary"
              className="flex-1 font-medium"
              onPress={handleShare}
            >
              📱 {t("common.share" as any) || "Share"}
            </Button>
          )}

          <Button
            variant="flat"
            color="default"
            className="flex-1 font-medium bg-default-100"
            onPress={handlePrint}
          >
            🖨 {t("common.print" as any) || "Print"}
          </Button>

          {bill.status !== "CANCELLED" && (
            <Button
              variant="solid"
              color="success"
              className="flex-1 font-medium px-1 text-white shadow-md shadow-success/20"
              onPress={handlePayment}
            >
              💰 {t("payments.record" as any) || "Payment"}
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}
