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

/**
 * Creates a UPI payment URI for initiating a payment.
 *
 * @param pa - Payee VPA (UPI ID) to receive the funds
 * @param pn - Payee name
 * @param am - Amount to be paid, formatted as a string (e.g., "100.00")
 * @param tn - Transaction note or description
 * @param cu - Currency code (e.g., "INR")
 * @returns A `upi://pay` URI containing the given parameters as query fields
 */
function buildUpiLink(params: {
  pa: string;
  pn: string;
  am: string;
  tn: string;
  cu: string;
}) {
  return `upi://pay?${new URLSearchParams(params).toString()}`;
}

/**
 * Builds a WhatsApp click-to-chat URL containing the given message and optional recipient phone.
 *
 * @param message - The message text to include in the WhatsApp URL; it will be URL-encoded.
 * @param phone - Optional recipient phone number; non-digit characters are removed and the India country code `91` is prepended if missing.
 * @returns The full `https://wa.me/` URL that opens a chat with the encoded message (and with the recipient if `phone` is provided).
 */
function buildWhatsAppUrl(message: string, phone?: string | null) {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    const withCode = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
    return `https://wa.me/${withCode}?text=${encoded}`;
  }

  return `https://wa.me/?text=${encoded}`;
}

/**
 * Share a formatted bill message (and optional UPI payment link) using the Web Share API, falling back to WhatsApp.
 *
 * Composes a message from the provided bill, customer, and company details. If `companyUpiId` is present and `grandTotal` > 0, a UPI "Pay Now" link is appended. The function attempts to invoke `navigator.share` and, if unavailable or not completed, opens a WhatsApp chat with the composed message.
 *
 * @param options - Input data used to compose the bill message. `customerPhone` is used for the WhatsApp fallback; `companyUpiId` is used to build a UPI payment link when present and `grandTotal` is greater than zero.
 * @returns `true` when sharing succeeds or the WhatsApp fallback is initiated, `false` if the Web Share API call is aborted (`AbortError`).
 */
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
    maximumFractionDigits: 0,
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
