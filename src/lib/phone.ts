/**
 * Phone normalization utilities for Indian phone numbers.
 * Used for tel: links, WhatsApp wa.me links, and display.
 */

export type ReminderLanguage = "hinglish" | "hindi" | "english";

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
 * Build a wa.me URL with a pre-filled reminder message.
 *
 * language:
 *   "hinglish" — Roman-script Hindi/English mix (default, widest reach)
 *   "hindi"    — Pure Devanagari Hindi
 *   "english"  — Formal English
 */
export function buildWhatsAppReminderUrl(opts: {
  phone: string;
  partyName: string;
  balanceAmount: number; // absolute value
  tenantName?: string;
  language?: ReminderLanguage;
}): string {
  const normalised = normalizeIndianPhone(opts.phone);
  if (!normalised) return "";

  const { partyName, balanceAmount, tenantName, language = "hinglish" } = opts;
  const firstName = partyName.split(" ")[0];
  const amt = `₹${balanceAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const suffix = tenantName ? `\n— ${tenantName}` : "";

  let message: string;

  switch (language) {
    case "hindi": {
      // Pure Devanagari
      if (balanceAmount > 0) {
        message =
          `नमस्ते ${firstName} जी,\n` +
          `आपके खाते में ${amt} का बकाया है।\n` +
          `कृपया जल्द भुगतान करें। धन्यवाद।` +
          suffix;
      } else {
        message =
          `नमस्ते ${firstName} जी,\n` +
          `आपका खाता क्लियर है। धन्यवाद!` +
          suffix;
      }
      break;
    }

    case "english": {
      // Formal English
      if (balanceAmount > 0) {
        message =
          `Dear ${firstName},\n` +
          `This is a friendly reminder that an amount of ${amt} is outstanding in your account.\n` +
          `Kindly clear the dues at your earliest convenience. Thank you.` +
          suffix;
      } else {
        message =
          `Dear ${firstName},\n` +
          `Your account is fully settled. Thank you!` +
          suffix;
      }
      break;
    }

    case "hinglish":
    default: {
      // Roman-script Hinglish (original behaviour)
      if (balanceAmount > 0) {
        message =
          `Namaste ${firstName} ji, aapse ${amt} ka hisaab baaki hai.\n` +
          `Jab convenient ho, please clear kar dein. Dhanyavaad.` +
          suffix;
      } else {
        message = `Namaste ${firstName} ji, aapka hisaab clear hai. Dhanyavaad!` + suffix;
      }
      break;
    }
  }

  return `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`;
}
