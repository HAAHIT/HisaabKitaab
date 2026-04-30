/**
 * Phone normalization utilities for Indian phone numbers.
 * Used for tel: links, WhatsApp wa.me links, and display.
 */

/**
 * Strip formatting and prepend country code for wa.me / tel: links.
 * Non-Indian numbers (already starting with a non-91 country code) are
 * returned as-is after stripping non-digits.
 */
export function normalizeIndianPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  // Remove everything except digits and leading +
  const stripped = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!stripped) return "";
  // If already has a country code prefix (starts with 91 and length 12)
  if (stripped.startsWith("91") && stripped.length === 12) return stripped;
  // If starts with 0 (STD format), drop the 0 and prepend 91
  if (stripped.startsWith("0") && stripped.length === 11) return "91" + stripped.slice(1);
  // 10-digit number → prepend 91
  if (stripped.length === 10) return "91" + stripped;
  // Anything else (short codes, international) — return as is
  return stripped;
}

/**
 * Build a wa.me URL with a pre-filled Hinglish reminder message.
 */
export function buildWhatsAppReminderUrl(opts: {
  phone: string;
  partyName: string;
  balanceAmount: number; // absolute value
  tenantName?: string;
}): string {
  const normalised = normalizeIndianPhone(opts.phone);
  if (!normalised) return "";

  const firstName = opts.partyName.split(" ")[0];
  const amt = `₹${opts.balanceAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  let message: string;
  if (opts.balanceAmount > 0) {
    message =
      `Namaste ${firstName} ji, aapse ${amt} ka hisaab baaki hai.\n` +
      `Jab convenient ho, please clear kar dein. Dhanyavaad.`;
    if (opts.tenantName) message += `\n— ${opts.tenantName}`;
  } else {
    message = `Namaste ${firstName} ji, aapka hisaab clear hai. Dhanyavaad!`;
    if (opts.tenantName) message += `\n— ${opts.tenantName}`;
  }

  return `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`;
}
