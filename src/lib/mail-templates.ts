interface ResetEmailParams {
  recipientName?: string | null;
  resetUrl: string;
  expiresAt: Date;
  /**
   * When true, framing is "an administrator initiated this reset for you".
   * When false (default), framing is "you requested this reset".
   */
  initiatedByAdmin?: boolean;
}

function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function buildPasswordResetEmail(params: ResetEmailParams) {
  const name = params.recipientName?.trim() || "there";
  const expiry = formatExpiry(params.expiresAt);
  const intro = params.initiatedByAdmin
    ? "An administrator initiated a password reset for your SoloBooks account."
    : "You requested a password reset for your SoloBooks account.";

  const subject = "Reset your SoloBooks password";

  const text = `Hi ${name},

${intro}

Use the link below to set a new password (expires ${expiry} IST):

${params.resetUrl}

If you didn't expect this email, you can safely ignore it — your password will not change unless the link is used.

— SoloBooks
`;

  // SoloBooks brand palette (mirrors src/components/ui/hk-design.tsx):
  //   primary       #2563eb  (CTA)
  //   primaryDark   #13224a  (headings)
  //   text          #1d1d1f
  //   muted         #6b6b70
  //   border        #e5e5ea
  //   surface       #faf7f2  (warm paper)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1d1d1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px;max-width:100%;overflow:hidden;">
          <tr>
            <td style="background:#13224a;padding:20px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">SoloBooks</p>
              <p style="margin:2px 0 0;font-size:12px;color:#a3b1d3;">GST billing &amp; Tally-compatible accounting</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#13224a;line-height:1.3;">Reset your password</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1d1d1f;">Hi ${name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1d1d1f;">${intro}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#1d1d1f;">
                Click the button below to set a new password. This link expires
                <strong style="color:#13224a;">${expiry} IST</strong>.
              </p>
              <p style="margin:0 0 28px;">
                <a href="${params.resetUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;">
                  Reset password
                </a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e5ea;margin:24px 0;" />
              <p style="margin:0;font-size:13px;color:#6b6b70;line-height:1.55;">
                If you didn't expect this email, you can safely ignore it — your password will
                not change unless the link above is used.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#faf7f2;padding:18px 32px;border-top:1px solid #e5e5ea;">
              <p style="margin:0;font-size:12px;color:#6b6b70;">
                SoloBooks · GST billing for Indian businesses · <a href="https://solobooks.in" style="color:#2563eb;text-decoration:none;">solobooks.in</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9a9aa1;">This is an automated message. Do not reply.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
