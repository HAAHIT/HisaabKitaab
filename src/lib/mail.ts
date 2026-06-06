import nodemailer from "nodemailer";
import { logError, logInfo } from "@/lib/observability";

/**
 * Transactional email via SMTP. Configured via env:
 *   SMTP_HOST       - e.g. "smtp.msg91.com"
 *   SMTP_PORT       - "587" (STARTTLS) or "465" (TLS)
 *   SMTP_USER       - MSG91 SMTP username
 *   SMTP_PASS       - MSG91 SMTP password
 *   MAIL_FROM       - "SoloBooks <noreply@solobooks.in>" (must be a verified sender on the SMTP provider)
 *   MAIL_REPLY_TO   - optional, e.g. "support@solobooks.in"
 *
 * If SMTP_HOST is unset, sendMail() resolves without sending so dev environments
 * don't fail when mail isn't configured.
 */

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional override of the default MAIL_FROM env value. */
  from?: string;
  /** Logical event name used in observability logs (e.g. "auth.password-reset"). */
  event: string;
}

interface SendMailResult {
  delivered: boolean;
  /** Provider message id when delivered. */
  messageId?: string;
  /** Reason when not delivered (e.g. "smtp_not_configured", "send_failed"). */
  reason?: string;
}

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  const port = parseInt(process.env.SMTP_PORT?.trim() ?? "587", 10);
  const secure = port === 465;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransport;
}

export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  const transport = getTransport();
  if (!transport) {
    logInfo("mail.skipped.smtp_not_configured", { event: params.event, to: params.to });
    return { delivered: false, reason: "smtp_not_configured" };
  }

  const from = params.from ?? process.env.MAIL_FROM?.trim();
  if (!from) {
    logError("mail.error.missing_from", { event: params.event });
    return { delivered: false, reason: "missing_from" };
  }

  const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;

  try {
    const info = await transport.sendMail({
      from,
      to: params.to,
      replyTo,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    logInfo("mail.sent", { event: params.event, to: params.to, messageId: info.messageId });
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    logError("mail.send_failed", { event: params.event, to: params.to, error });
    return { delivered: false, reason: "send_failed" };
  }
}
