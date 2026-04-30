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
    // Basic language extraction from cookies on client-side
    const match = document.cookie.match(/(?:^|;)\s*hisaabkitaab-lang=([^;]*)/);
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
      setErrorMessage(t("login.emailPasswordRequired")); // "Email or phone and password are required"
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

        router.push("/");
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
    padding: "0 16px",
    height: 48,
    borderRadius: 12,
    border: "1.5px solid var(--hk-border)",
    background: "var(--hk-input)",
    transition: "border-color 0.15s",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 15,
    fontWeight: 500,
    color: "var(--hk-text)",
    fontFamily: "var(--font-space-grotesk), sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--hk-sub)",
    marginBottom: 8,
    fontFamily: "var(--font-space-grotesk), sans-serif",
  };

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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
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
              {t("register.title")}
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
              {t("register.subtitle")}
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

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Company Name */}
            <label htmlFor="company-input" style={{ display: "block" }}>
              <span style={labelStyle}>{t("register.companyName")}</span>
              <div className="hk-login-input-group" style={inputGroupStyle}>
                <input
                  id="company-input"
                  name="companyName"
                  type="text"
                  required
                  style={inputStyle}
                  placeholder={t("register.companyNamePlaceholder")}
                />
              </div>
            </label>

            {/* Full Name */}
            <label htmlFor="name-input" style={{ display: "block" }}>
              <span style={labelStyle}>{t("register.name")}</span>
              <div className="hk-login-input-group" style={inputGroupStyle}>
                <input
                  id="name-input"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  style={inputStyle}
                  placeholder={t("register.namePlaceholder")}
                />
              </div>
            </label>

            {/* Credential */}
            <label htmlFor="credential-input" style={{ display: "block" }}>
              <span style={labelStyle}>{t("login.credentialLabel")}</span>
              <div className="hk-login-input-group" style={inputGroupStyle}>
                <input
                  id="credential-input"
                  name="credential"
                  type="text"
                  required
                  style={inputStyle}
                  placeholder={t("login.credentialPlaceholder")}
                />
              </div>
            </label>

            {/* Password */}
            <label htmlFor="password-input" style={{ display: "block" }}>
              <span style={labelStyle}>{t("login.passwordLabel")}</span>
              <div className="hk-login-input-group" style={inputGroupStyle}>
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  style={inputStyle}
                  placeholder={t("login.passwordPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("common.hide") : t("common.show")}
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
                {errorMessage}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
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
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(247, 96, 0, 0.3)",
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
                    animation: "hk-spin 0.7s linear infinite",
                  }}
                />
              )}
              <span>{isPending ? t("register.signingUp") : t("register.signUp")}</span>
            </button>
          </form>

          {/* Login link */}
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
            {t("register.hasAccount")}{" "}
            <a
              href="/login"
              style={{
                fontWeight: 700,
                color: "#f76000",
                textDecoration: "none",
              }}
            >
              {t("register.login")}
            </a>
          </div>
        </div>
      </div>

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
          `,
        }}
      />
    </div>
  );
}
