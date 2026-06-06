"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getTranslation,
  normalizeLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n/translations";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;)\s*solobooks-lang=([^;]*)/);
    setLanguage(normalizeLanguage(match ? match[1] : undefined));
  }, []);

  const t = (key: TranslationKey) => getTranslation(language, key);
  const nextLanguage = language === "en" ? "hi" : "en";
  const languageSwitchUrl = `/api/preferences/language?lang=${nextLanguage}&returnTo=${encodeURIComponent("/register")}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const credential = formData.get("credential") as string;
    const password = formData.get("password") as string;
    const companyName = formData.get("companyName") as string;

    if (!name || !credential || !password || !companyName) {
      setErrorMessage(t("login.emailPasswordRequired"));
      return;
    }

    if (password.length < 12) {
      setErrorMessage(t("users.passwordMin"));
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailPattern.test(credential);

    const bodyData = {
      name,
      companyName,
      password,
      ...(isEmail ? { email: credential } : { phone: credential }),
    };

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || t("register.error"));
        }

        // Register now issues a session cookie, so go straight into the app —
        // the (app) layout routes new tenants into the onboarding wizard.
        router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/");
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : t("login.serverError")
        );
      }
    });
  }

  const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
    height: 48,
    borderRadius: 10,
    border: "1.5px solid var(--sb-border)",
    background: "var(--sb-input)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 15,
    fontWeight: 500,
    color: "var(--sb-text)",
  };

  const labelTextStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--sb-text)",
    marginBottom: 8,
  };

  const iconProps = {
    width: 18,
    height: 18,
    fill: "none",
    stroke: "var(--sb-sub)",
    viewBox: "0 0 24 24",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    style: { flexShrink: 0 },
  };

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
              "radial-gradient(circle at center, rgba(37, 99, 235, 0.35) 0%, rgba(37, 99, 235, 0.18) 45%, transparent 70%)",
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
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)",
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

        {/* Headline block */}
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
              style={{ color: "#2563eb" }}
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
              {t("register.title")}
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "var(--sb-sub)",
                marginTop: 8,
              }}
            >
              {t("register.subtitle")}
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
                background: "rgba(37, 99, 235, 0.10)",
                color: "#2563eb",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              {nextLanguage.toUpperCase()}
            </a>
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Company Name */}
            <label htmlFor="company-input" style={{ display: "block" }}>
              <span style={labelTextStyle}>{t("register.companyName")}</span>
              <div className="sb-login-input-group" style={inputGroupStyle}>
                <svg {...iconProps}>
                  <path d="M3 21V7l9-4 9 4v14" />
                  <path d="M9 21V12h6v9" />
                  <path d="M3 21h18" />
                </svg>
                <input
                  id="company-input"
                  name="companyName"
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder={t("register.companyNamePlaceholder")}
                  style={inputStyle}
                />
              </div>
            </label>

            {/* Full Name */}
            <label htmlFor="name-input" style={{ display: "block" }}>
              <span style={labelTextStyle}>{t("register.name")}</span>
              <div className="sb-login-input-group" style={inputGroupStyle}>
                <svg {...iconProps}>
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  id="name-input"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder={t("register.namePlaceholder")}
                  style={inputStyle}
                />
              </div>
            </label>

            {/* Credential */}
            <label htmlFor="credential-input" style={{ display: "block" }}>
              <span style={labelTextStyle}>{t("login.credentialLabel")}</span>
              <div className="sb-login-input-group" style={inputGroupStyle}>
                <svg {...iconProps}>
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 6l8 7 8-7" />
                </svg>
                <input
                  id="credential-input"
                  name="credential"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder={t("login.credentialPlaceholder")}
                  style={inputStyle}
                />
              </div>
            </label>

            {/* Password */}
            <label htmlFor="password-input" style={{ display: "block" }}>
              <span style={labelTextStyle}>{t("login.passwordLabel")}</span>
              <div className="sb-login-input-group" style={inputGroupStyle}>
                <svg {...iconProps}>
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder={t("login.passwordPlaceholder")}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? t("common.hide") : t("common.show")}
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
                  <span className="sr-only">{showPassword ? t("common.hide") : t("common.show")}</span>
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {/* Error */}
            {errorMessage && (
              <p
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(196, 62, 28, 0.25)",
                  background: "rgba(196, 62, 28, 0.08)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#c43e1c",
                }}
                aria-live="polite"
              >
                {errorMessage}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 50,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(37, 99, 235, 0.3)",
                opacity: isPending ? 0.7 : 1,
                transition: "opacity 0.15s, transform 0.15s",
              }}
            >
              {isPending && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    display: "inline-block",
                    animation: "sb-spin 0.7s linear infinite",
                  }}
                />
              )}
              <span>{isPending ? t("register.signingUp") : t("register.signUp")}</span>
            </button>
          </form>

          {/* Login link */}
          <div
            style={{
              marginTop: 28,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--sb-sub)",
            }}
          >
            {t("register.hasAccount")}{" "}
            <a
              href="/login"
              style={{
                fontWeight: 700,
                color: "#2563eb",
                textDecoration: "none",
              }}
            >
              {t("register.login")}
            </a>
          </div>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes sb-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .sb-login-input-group:focus-within {
              border-color: #2563eb !important;
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
            }
            @media (max-width: 1023px) {
              .sb-auth-marketing { display: none !important; }
              .sb-auth-form-panel { flex: 1 1 100% !important; }
            }
          `,
        }}
      />
    </div>
  );
}
