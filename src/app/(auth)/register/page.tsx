"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getTranslation,
  normalizeLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n/translations";

type Feature = {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  icon: React.ReactNode;
};

const FEATURE_ICON_PROPS = {
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURES: Feature[] = [
  {
    titleKey: "auth.brand.feature1Title",
    bodyKey: "auth.brand.feature1Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <path d="M4 7h12l4 4v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        <path d="M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    titleKey: "auth.brand.feature2Title",
    bodyKey: "auth.brand.feature2Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <path d="M12 3v18" />
        <path d="M5 8h14" />
        <path d="M5 8l-3 6a3 3 0 0 0 6 0L5 8z" />
        <path d="M19 8l-3 6a3 3 0 0 0 6 0l-3-6z" />
      </svg>
    ),
  },
  {
    titleKey: "auth.brand.feature3Title",
    bodyKey: "auth.brand.feature3Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="7.5" cy="7.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
      </svg>
    ),
  },
  {
    titleKey: "auth.brand.feature4Title",
    bodyKey: "auth.brand.feature4Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    titleKey: "auth.brand.feature5Title",
    bodyKey: "auth.brand.feature5Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <path d="M12 3l8 3v5c0 4.5-3.4 8.6-8 10-4.6-1.4-8-5.5-8-10V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    titleKey: "auth.brand.feature6Title",
    bodyKey: "auth.brand.feature6Body",
    icon: (
      <svg {...FEATURE_ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18z" />
      </svg>
    ),
  },
];

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
    gap: 10,
    padding: "0 14px",
    height: 46,
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
    fontSize: 14,
    fontWeight: 500,
    color: "var(--hk-text)",
    fontFamily: "var(--font-space-grotesk), sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--hk-sub)",
    marginBottom: 6,
    fontFamily: "var(--font-space-grotesk), sans-serif",
  };

  return (
    <div
      className="hk-auth-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--hk-bg)",
        fontFamily: "var(--font-space-grotesk), sans-serif",
      }}
    >
      {/* Left highlights panel — 75% */}
      <aside
        className="hk-auth-highlights"
        style={{
          flex: "0 0 70%",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #f76000 0%, #ef4a3a 35%, #7b5ef6 100%)",
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
            top: -160,
            left: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.18)",
            filter: "blur(100px)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -160,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.18)",
            filter: "blur(120px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.18)",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(6px)",
            }}
          >
            <svg
              width="24"
              height="24"
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
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.3px",
                lineHeight: 1.1,
              }}
            >
              HisaabKitaab
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.82)",
                marginTop: 2,
              }}
            >
              {t("auth.brand.tagline")}
            </div>
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ maxWidth: 720 }}>
            <h2
              style={{
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: "-1px",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {t("auth.brand.headline")}
            </h2>
            <p
              style={{
                fontSize: 17,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.88)",
                lineHeight: 1.55,
                marginTop: 16,
                maxWidth: 640,
              }}
            >
              {t("auth.brand.subheadline")}
            </p>
          </div>

          <ul
            className="hk-auth-feature-grid"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 18,
              maxWidth: 760,
            }}
          >
            {FEATURES.map((feature) => (
              <li
                key={feature.titleKey}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "16px 18px",
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {feature.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                    {t(feature.titleKey)}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255, 255, 255, 0.82)",
                      lineHeight: 1.5,
                    }}
                  >
                    {t(feature.bodyKey)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            position: "relative",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.72)",
          }}
        >
          © {new Date().getFullYear()} HisaabKitaab
        </div>
      </aside>

      {/* Right form panel — 25% */}
      <main
        className="hk-auth-form-panel"
        style={{
          flex: "0 0 30%",
          display: "flex",
          alignItems: "center",
          justifyContent: "stretch",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(247, 96, 0, 0.3)",
              }}
            >
              <svg
                width="26"
                height="26"
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
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: "-0.5px",
                  background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {t("register.title")}
              </h1>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--hk-sub)",
                  marginTop: 6,
                }}
              >
                {t("register.subtitle")}
              </p>
            </div>
          </div>

          {/* Language switch */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <a
              href={languageSwitchUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 32,
                minWidth: 52,
                padding: "0 12px",
                borderRadius: 10,
                background: "rgba(123, 94, 246, 0.12)",
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

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                    width: 30,
                    height: 30,
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
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(247, 96, 0, 0.25)",
                  background: "rgba(247, 96, 0, 0.08)",
                  fontSize: 13,
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
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, #f76000, #7b5ef6)",
                color: "#fff",
                fontSize: 15,
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
              marginTop: 20,
              textAlign: "center",
              fontSize: 13,
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
      </main>

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
            @media (max-width: 1023px) {
              .hk-auth-highlights { display: none !important; }
              .hk-auth-form-panel { flex: 1 1 100% !important; }
            }
          `,
        }}
      />
    </div>
  );
}
