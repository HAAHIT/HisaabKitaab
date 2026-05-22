"use client";

interface ShareBillOptions {
  billNumber: string;
  customerName: string;
  grandTotal: number;
  customerPhone?: string | null;
  companyName: string;
  companyUpiId?: string | null;
  billUrl: string;
}

function buildUpiLink(params: {
  pa: string;
  pn: string;
  am: string;
  tn: string;
  cu: string;
}) {
  return `upi://pay?${new URLSearchParams(params).toString()}`;
}

function buildWhatsAppUrl(message: string, phone?: string | null) {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    const withCode = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
    return `https://wa.me/${withCode}?text=${encoded}`;
  }

  return `https://wa.me/?text=${encoded}`;
}

export async function shareBill(options: ShareBillOptions): Promise<boolean> {
  const {
    billNumber,
    customerName,
    grandTotal,
    customerPhone,
    companyName,
    companyUpiId,
    billUrl,
  } = options;

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grandTotal);

  let message = `Bill from ${companyName}\n\n`;
  message += `Customer: ${customerName}\n`;
  message += `Bill No: ${billNumber}\n`;
  message += `Amount: ${formattedAmount}\n`;
  message += `View Bill: ${billUrl}\n`;

  if (companyUpiId && grandTotal > 0) {
    const upiLink = buildUpiLink({
      pa: companyUpiId,
      pn: companyName,
      am: grandTotal.toFixed(2),
      tn: `Payment for ${billNumber}`,
      cu: "INR",
    });
    message += `Pay Now: ${upiLink}\n`;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: `Bill ${billNumber}`,
        text: message,
      });
      return true;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return false;
      }
    }
  }

  window.open(buildWhatsAppUrl(message, customerPhone), "_blank", "noopener,noreferrer");
  return true;
}
