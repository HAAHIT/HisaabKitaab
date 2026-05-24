import { cookies } from "next/headers";
import Script from "next/script";
import {
  getTranslation,
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
  type TranslationKey,
} from "@/lib/i18n/translations";

type ResetSearchParams = {
  token?: string | string[] | undefined;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<ResetSearchParams>;
}) {
  const cookieStore = await cookies();
  const language = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
  const t = (key: TranslationKey) => getTranslation(language, key);
  const params = await searchParams;
  const token = firstValue(params.token) || "";
  const hasToken = token.length > 0;

  return (
    <div
      className="sb-auth-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--sb-bg)",
        fontFamily: "var(--font-space-grotesk), sans-serif",
        padding: "48px 24px",
      }}
    >
      <main
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              color: "var(--sb-text)",
              margin: 0,
            }}
          >
            {t("resetPassword.title")}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--sb-sub)",
              marginTop: 8,
            }}
          >
            {hasToken ? t("resetPassword.subtitle") : t("resetPassword.missingToken")}
          </p>
        </div>

        {hasToken ? (
          <form
            id="reset-password-form"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <input type="hidden" name="token" value={token} />

            <label htmlFor="password-input" style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--sb-text)",
                  marginBottom: 8,
                }}
              >
                {t("resetPassword.newPassword")}
              </span>
              <input
                id="password-input"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                placeholder={t("resetPassword.passwordPlaceholder")}
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-input)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--sb-text)",
                  outline: "none",
                }}
              />
            </label>

            <label htmlFor="confirm-input" style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--sb-text)",
                  marginBottom: 8,
                }}
              >
                {t("resetPassword.confirmPassword")}
              </span>
              <input
                id="confirm-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                placeholder={t("resetPassword.confirmPlaceholder")}
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-input)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--sb-text)",
                  outline: "none",
                }}
              />
            </label>

            <div
              id="reset-message"
              data-mismatch={t("resetPassword.mismatch")}
              data-tooShort={t("resetPassword.tooShort")}
              data-success={t("resetPassword.success")}
              data-networkError={t("resetPassword.networkError")}
              style={{ display: "none" }}
              aria-live="polite"
            />

            <button
              id="reset-submit"
              type="submit"
              data-default-label={t("resetPassword.submit")}
              data-submitting-label={t("resetPassword.submitting")}
              style={{
                marginTop: 4,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(37, 99, 235, 0.3)",
              }}
            >
              {t("resetPassword.submit")}
            </button>
          </form>
        ) : null}

        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 13,
            color: "var(--sb-sub)",
          }}
        >
          <a
            href="/login"
            style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
          >
            {t("resetPassword.backToLogin")}
          </a>
        </div>
      </main>

      <Script
        id="reset-password-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const form = document.getElementById("reset-password-form");
              if (!form) return;
              const passwordInput = document.getElementById("password-input");
              const confirmInput = document.getElementById("confirm-input");
              const messageBox = document.getElementById("reset-message");
              const submitBtn = document.getElementById("reset-submit");
              if (!passwordInput || !confirmInput || !messageBox || !submitBtn) return;

              const defaultLabel = submitBtn.getAttribute("data-default-label") || "";
              const submittingLabel = submitBtn.getAttribute("data-submitting-label") || "";

              const showMessage = (text, isError) => {
                messageBox.textContent = text;
                messageBox.style.display = "block";
                messageBox.style.padding = "10px 14px";
                messageBox.style.borderRadius = "10px";
                messageBox.style.fontSize = "13px";
                messageBox.style.fontWeight = "600";
                if (isError) {
                  messageBox.style.background = "rgba(196, 62, 28, 0.08)";
                  messageBox.style.border = "1px solid rgba(196, 62, 28, 0.25)";
                  messageBox.style.color = "#c43e1c";
                } else {
                  messageBox.style.background = "rgba(34, 139, 34, 0.08)";
                  messageBox.style.border = "1px solid rgba(34, 139, 34, 0.25)";
                  messageBox.style.color = "#1f7a1f";
                }
              };

              form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const password = String(formData.get("password") || "");
                const confirmPassword = String(formData.get("confirmPassword") || "");
                const token = String(formData.get("token") || "");

                if (password.length < 12) {
                  showMessage(messageBox.getAttribute("data-tooShort") || "Password too short", true);
                  return;
                }
                if (password !== confirmPassword) {
                  showMessage(messageBox.getAttribute("data-mismatch") || "Passwords do not match", true);
                  return;
                }

                submitBtn.setAttribute("disabled", "true");
                submitBtn.style.opacity = "0.7";
                submitBtn.style.cursor = "not-allowed";
                submitBtn.textContent = submittingLabel;

                try {
                  const res = await fetch("/api/auth/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, password }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(json.error || messageBox.getAttribute("data-networkError") || "Error");
                  }
                  showMessage(messageBox.getAttribute("data-success") || "Password updated", false);
                  setTimeout(() => { window.location.href = "/login"; }, 1500);
                } catch (err) {
                  showMessage(err.message, true);
                  submitBtn.removeAttribute("disabled");
                  submitBtn.style.opacity = "1";
                  submitBtn.style.cursor = "pointer";
                  submitBtn.textContent = defaultLabel;
                }
              });
            })();
          `,
        }}
      />
    </div>
  );
}
