import { cookies } from "next/headers";
import Script from "next/script";
import {
  getTranslation,
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n/translations";

type LoginSearchParams = {
  error?: string | string[] | undefined;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(language: Language, errorCode: string | undefined) {
  const errorMessages: Record<string, TranslationKey> = {
    missing_credentials: "login.emailPasswordRequired",
    invalid_credentials: "login.invalidCredentials",
    throttled: "login.tooManyAttempts",
    server_error: "login.serverError",
  };

  const key = errorCode ? errorMessages[errorCode] : undefined;
  return key ? getTranslation(language, key) : "";
}

function getSafeReturnPath(pathname: string) {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.startsWith("/\\")) {
    return "/login";
  }

  return pathname;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const cookieStore = await cookies();
  const language = normalizeLanguage(
    cookieStore.get(LANGUAGE_COOKIE_NAME)?.value
  );
  const t = (key: TranslationKey) => getTranslation(language, key);
  const params = await searchParams;
  const errorMessage = getErrorMessage(language, firstValue(params.error));
  const nextLanguage = language === "en" ? "hi" : "en";
  const languageSwitchUrl = `/api/preferences/language?lang=${nextLanguage}&returnTo=${encodeURIComponent(
    getSafeReturnPath("/login")
  )}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--hk-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-space-grotesk), sans-serif",
      }}
    >
      {/* Background decorative blurs */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(247, 96, 0, 0.12)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          left: -120,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(123, 94, 246, 0.12)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background: "var(--hk-card)",
          borderRadius: 24,
          border: "1px solid var(--hk-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "36px 28px 24px",
            textAlign: "center",
          }}
        >
          {/* HK Logo */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #f76000, #7b5ef6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(247, 96, 0, 0.3)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="9" y1="12" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.5px",
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.2,
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}
            >
              HisaabKitaab
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--hk-sub)",
                marginTop: 6,
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}
            >
              {t("login.subtitle")}
            </p>
          </div>
        </div>

        {/* Form */}
        <div
          style={{
            borderTop: "1px solid var(--hk-border)",
            padding: "24px 28px 32px",
          }}
        >
          {/* Language switch */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <a
              href={languageSwitchUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 36,
                minWidth: 56,
                padding: "0 14px",
                borderRadius: 10,
                background: "rgba(123, 94, 246, 0.12)",
                color: "#7b5ef6",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-space-grotesk), sans-serif",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              {nextLanguage.toUpperCase()}
            </a>
          </div>

          <form
            action="/api/auth/login"
            method="post"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Credential input */}
            <label htmlFor="credential-input" style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--hk-sub)",
                  marginBottom: 8,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
              >
                {t("login.credentialLabel")}
              </span>
              <div
                className="hk-login-input-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 16px",
                  height: 48,
                  borderRadius: 12,
                  border: "1.5px solid var(--hk-border)",
                  background: "var(--hk-input)",
                  transition: "border-color 0.15s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="var(--hk-sub)"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  id="credential-input"
                  name="credential"
                  type="text"
                  autoComplete="username"
                  placeholder={t("login.credentialPlaceholder")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--hk-text)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                  }}
                />
              </div>
            </label>

            {/* Password input */}
            <label htmlFor="password-input" style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--hk-sub)",
                  marginBottom: 8,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
              >
                {t("login.passwordLabel")}
              </span>
              <div
                className="hk-login-input-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 16px",
                  height: 48,
                  borderRadius: 12,
                  border: "1.5px solid var(--hk-border)",
                  background: "var(--hk-input)",
                  transition: "border-color 0.15s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="var(--hk-sub)"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--hk-text)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                  }}
                />
                <button
                  id="password-toggle"
                  type="button"
                  aria-controls="password-input"
                  aria-pressed="false"
                  data-show-label={t("common.show")}
                  data-hide-label={t("common.hide")}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "var(--hk-sub)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  <span className="sr-only">{t("common.show")}</span>
                  <svg
                    id="password-icon-hidden"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg
                    id="password-icon-visible"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    style={{ display: "none" }}
                  >
                    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </label>

            {/* Error display */}
            <div id="login-error-container" style={{ display: errorMessage ? "block" : "none" }}>
              <p
                id="login-error-text"
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(247, 96, 0, 0.25)",
                  background: "rgba(247, 96, 0, 0.08)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#f76000",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
                aria-live="polite"
              >
                {errorMessage || ""}
              </p>
            </div>

            {/* Submit button */}
            <button
              id="login-button"
              type="submit"
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 50,
                borderRadius: 14,
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "var(--font-space-grotesk), sans-serif",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(247, 96, 0, 0.3)",
                transition: "opacity 0.15s, transform 0.15s",
              }}
            >
              <div
                id="login-spinner"
                style={{ display: "none", position: "relative", width: 20, height: 20, flexShrink: 0 }}
                aria-hidden="true"
              >
                <i
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    border: "2.5px solid transparent",
                    borderBottomColor: "currentColor",
                    animation: "hk-spin 0.7s linear infinite",
                  }}
                />
              </div>
              <span id="login-label">{t("login.signIn")}</span>
            </button>

            {/* Forgot password */}
            <button
              id="forgot-password-trigger"
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: "#7b5ef6",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                padding: "4px 0",
                transition: "opacity 0.15s",
              }}
            >
              {t("login.forgotPassword")}
            </button>
          </form>

          {/* Sign up link */}
          <div
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--hk-sub)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            {t("login.noAccount")}{" "}
            <a
              href="/register"
              style={{
                fontWeight: 700,
                color: "#f76000",
                textDecoration: "none",
              }}
            >
              {t("login.signUp")}
            </a>
          </div>
        </div>
      </div>

      {/* Forgot password dialog */}
      <dialog
        id="forgot-password-dialog"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          width: "calc(100vw - 2rem)",
          maxWidth: 420,
          borderRadius: 20,
          border: "1px solid var(--hk-border)",
          background: "var(--hk-card)",
          padding: 0,
          color: "var(--hk-text)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          fontFamily: "var(--font-space-grotesk), sans-serif",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid var(--hk-border)",
            padding: "18px 24px",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--hk-text)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            {t("login.forgotPasswordTitle")}
          </h2>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.6,
              color: "var(--hk-sub)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            {t("login.forgotPasswordBody")}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid var(--hk-border)",
            padding: "14px 24px",
          }}
        >
          <button
            id="forgot-password-close"
            type="button"
            style={{
              minHeight: 40,
              padding: "0 20px",
              borderRadius: 10,
              background: "rgba(123, 94, 246, 0.12)",
              color: "#7b5ef6",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-space-grotesk), sans-serif",
              border: "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {t("common.ok")}
          </button>
        </div>
      </dialog>

      {/* Inline styles for focus + spinner animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes hk-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .hk-login-input-group:focus-within {
              border-color: #f76000 !important;
              box-shadow: 0 0 0 3px rgba(247, 96, 0, 0.1);
            }
            #forgot-password-dialog::backdrop {
              background: rgba(0, 0, 0, 0.45);
              backdrop-filter: blur(4px);
            }
          `,
        }}
      />

      <Script
        id="login-interactions"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const form = document.querySelector("form");
              const loginBtn = document.getElementById("login-button");
              const loginSpinner = document.getElementById("login-spinner");
              const loginLabel = document.getElementById("login-label");
              const defaultLabel = loginLabel ? loginLabel.textContent : "Sign in";
              const errorContainer = document.getElementById("login-error-container");
              const errorText = document.getElementById("login-error-text");

              if (form && loginBtn && loginSpinner && loginLabel) {
                form.addEventListener("submit", async (e) => {
                  e.preventDefault();
                  
                  // Clear previous errors
                  if (errorContainer && errorText) {
                    errorContainer.style.display = "none";
                    errorText.textContent = "";
                  }

                  // Set loading state
                  loginBtn.setAttribute("disabled", "true");
                  loginBtn.style.opacity = "0.7";
                  loginBtn.style.cursor = "not-allowed";
                  loginSpinner.style.display = "flex";
                  loginLabel.textContent = "Signing in\\u2026";

                  try {
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());

                    const res = await fetch("/api/auth/login", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(data),
                    });

                    const json = await res.json();
                    
                    if (!res.ok) {
                      throw new Error(json.error || "An unexpected error occurred");
                    }

                    // Success - redirect to dashboard natively
                    window.location.href = json.redirectTo || "/dashboard";
                    
                  } catch (err) {
                    // Show error gracefully without URL refresh
                    if (errorContainer && errorText) {
                      errorText.textContent = err.message;
                      errorContainer.style.display = "block";
                      
                      // Clean up URL if it previously had an error
                      const url = new URL(window.location.href);
                      if (url.searchParams.has("error")) {
                        url.searchParams.delete("error");
                        window.history.replaceState({}, document.title, url.toString());
                      }
                    }
                  } finally {
                    // Reset UI State if error (if success, page will navigate away)
                    loginBtn.removeAttribute("disabled");
                    loginBtn.style.opacity = "1";
                    loginBtn.style.cursor = "pointer";
                    loginSpinner.style.display = "none";
                    loginLabel.textContent = defaultLabel;
                  }
                });
              }

              const input = document.getElementById("password-input");
              const toggle = document.getElementById("password-toggle");
              const hiddenIcon = document.getElementById("password-icon-hidden");
              const visibleIcon = document.getElementById("password-icon-visible");
              if (input && toggle) {
                toggle.addEventListener("click", () => {
                  const nextVisible = input.type === "password";
                  input.type = nextVisible ? "text" : "password";
                  toggle.setAttribute("aria-pressed", String(nextVisible));
                  toggle.setAttribute(
                    "aria-label",
                    nextVisible
                      ? toggle.getAttribute("data-hide-label") || "Hide"
                      : toggle.getAttribute("data-show-label") || "Show"
                  );
                  if (hiddenIcon && visibleIcon) {
                    hiddenIcon.style.display = nextVisible ? "none" : "block";
                    visibleIcon.style.display = nextVisible ? "block" : "none";
                  }
                });
              }

              const dialog = document.getElementById("forgot-password-dialog");
              const trigger = document.getElementById("forgot-password-trigger");
              const closeButton = document.getElementById("forgot-password-close");
              if (dialog instanceof HTMLDialogElement) {
                dialog.addEventListener("close", () => {
                  document.body.classList.remove("overflow-hidden");
                });
                if (trigger) {
                  trigger.addEventListener("click", () => {
                    dialog.showModal();
                    document.body.classList.add("overflow-hidden");
                  });
                }
                if (closeButton) {
                  closeButton.addEventListener("click", () => dialog.close());
                }
                dialog.addEventListener("click", (event) => {
                  const rect = dialog.getBoundingClientRect();
                  const withinDialog =
                    rect.top <= event.clientY &&
                    event.clientY <= rect.top + rect.height &&
                    rect.left <= event.clientX &&
                    event.clientX <= rect.left + rect.width;
                  if (!withinDialog) {
                    dialog.close();
                  }
                });
              }
            })();
          `,
        }}
      />
    </div>
  );

}
