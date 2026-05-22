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
      className="sb-auth-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--sb-bg)",
        fontFamily: "var(--font-space-grotesk), sans-serif",
      }}
    >
      {/* Marketing side — 60% */}
      <aside
        className="sb-auth-marketing"
        style={{
          flex: "0 0 60%",
          position: "relative",
          overflow: "hidden",
          background: "#0b0a1a",
          color: "#fff",
          padding: "56px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Single soft gradient bloom — anchors the brand without competing with the CTA */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -200,
            right: -180,
            width: 620,
            height: 620,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(247, 96, 0, 0.35) 0%, rgba(123, 94, 246, 0.22) 45%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* Brand mark */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #f76000, #7b5ef6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(247, 96, 0, 0.35)",
            }}
          >
            <svg
              width="20"
              height="20"
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
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.2px" }}>
            SoloBooks
          </div>
        </div>

        {/* Headline block — the only thing competing for attention with the form */}
        <div style={{ position: "relative", maxWidth: 640 }}>
          <h2
            style={{
              fontSize: "clamp(36px, 4.4vw, 56px)",
              fontWeight: 700,
              letterSpacing: "-1.2px",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            {t("auth.brand.headline")}
          </h2>
          <p
            style={{
              fontSize: 18,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.72)",
              lineHeight: 1.55,
              marginTop: 20,
              maxWidth: 540,
            }}
          >
            {t("auth.brand.subheadline")}
          </p>

          {/* Single trust line */}
          <div
            style={{
              marginTop: 32,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.86)",
            }}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#f76000" }}
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            {t("auth.brand.trust")}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.48)",
          }}
        >
          © {new Date().getFullYear()} SoloBooks
        </div>
      </aside>

      {/* Form side — 40% */}
      <main
        className="sb-auth-form-panel"
        style={{
          flex: "0 0 40%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.5px",
                color: "var(--sb-text)",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {t("login.signIn")}
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "var(--sb-sub)",
                marginTop: 8,
              }}
            >
              {t("login.subtitle")}
            </p>
          </div>

          {/* Language switch */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <a
              href={languageSwitchUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 30,
                minWidth: 48,
                padding: "0 10px",
                borderRadius: 8,
                background: "rgba(123, 94, 246, 0.10)",
                color: "#7b5ef6",
                fontSize: 12,
                fontWeight: 700,
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
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--sb-text)",
                  marginBottom: 8,
                }}
              >
                {t("login.credentialLabel")}
              </span>
              <div
                className="sb-login-input-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 14px",
                  height: 48,
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-input)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="var(--sb-sub)"
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
                    color: "var(--sb-text)",
                  }}
                />
              </div>
            </label>

            {/* Password input + Forgot link above */}
            <label htmlFor="password-input" style={{ display: "block" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sb-text)" }}>
                  {t("login.passwordLabel")}
                </span>
                <button
                  id="forgot-password-trigger"
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#7b5ef6",
                    padding: 0,
                    transition: "opacity 0.15s",
                  }}
                >
                  {t("login.forgotPassword")}
                </button>
              </div>
              <div
                className="sb-login-input-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 14px",
                  height: 48,
                  borderRadius: 10,
                  border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-input)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="var(--sb-sub)"
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
                    color: "var(--sb-text)",
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
                    color: "var(--sb-sub)",
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
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(247, 96, 0, 0.25)",
                  background: "rgba(247, 96, 0, 0.08)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f76000",
                }}
                aria-live="polite"
              >
                {errorMessage || ""}
              </p>
            </div>

            {/* Primary CTA */}
            <button
              id="login-button"
              type="submit"
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 50,
                borderRadius: 12,
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
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
                    animation: "sb-spin 0.7s linear infinite",
                  }}
                />
              </div>
              <span id="login-label">{t("login.signIn")}</span>
            </button>
          </form>

          {/* Sign up link */}
          <div
            style={{
              marginTop: 28,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--sb-sub)",
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
      </main>

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
          border: "1px solid var(--sb-border)",
          background: "var(--sb-card)",
          padding: 0,
          color: "var(--sb-text)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          fontFamily: "var(--font-space-grotesk), sans-serif",
        }}
      >
        <div style={{ borderBottom: "1px solid var(--sb-border)", padding: "18px 24px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sb-text)" }}>
            {t("login.forgotPasswordTitle")}
          </h2>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: "var(--sb-sub)" }}>
            {t("login.forgotPasswordBody")}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid var(--sb-border)",
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
              border: "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {t("common.ok")}
          </button>
        </div>
      </dialog>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes sb-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .sb-login-input-group:focus-within {
              border-color: #f76000 !important;
              box-shadow: 0 0 0 3px rgba(247, 96, 0, 0.12);
            }
            #forgot-password-dialog::backdrop {
              background: rgba(0, 0, 0, 0.45);
              backdrop-filter: blur(4px);
            }
            @media (max-width: 1023px) {
              .sb-auth-marketing { display: none !important; }
              .sb-auth-form-panel { flex: 1 1 100% !important; }
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

                  if (errorContainer && errorText) {
                    errorContainer.style.display = "none";
                    errorText.textContent = "";
                  }

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

                    window.location.href = json.redirectTo || "/dashboard";

                  } catch (err) {
                    if (errorContainer && errorText) {
                      errorText.textContent = err.message;
                      errorContainer.style.display = "block";

                      const url = new URL(window.location.href);
                      if (url.searchParams.has("error")) {
                        url.searchParams.delete("error");
                        window.history.replaceState({}, document.title, url.toString());
                      }
                    }
                  } finally {
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
