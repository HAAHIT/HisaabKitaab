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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 py-10 text-foreground dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-white/60 bg-white/95 shadow-2xl shadow-blue-950/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-col items-center gap-3 px-6 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
            <svg
              className="h-9 w-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-blue-600">
              {t("register.title")}
            </h1>
            <p className="text-sm text-gray-400 dark:text-zinc-400">
              {t("register.subtitle")}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 pb-8 pt-5 dark:border-zinc-800">
          <div className="mb-5 flex justify-end">
            <a
              href={languageSwitchUrl}
              className="inline-flex min-h-10 min-w-16 items-center justify-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/15"
            >
              {nextLanguage.toUpperCase()}
            </a>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            
            <label htmlFor="company-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("register.companyName")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <input
                  id="company-input"
                  name="companyName"
                  type="text"
                  required
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder={t("register.companyNamePlaceholder")}
                />
              </div>
            </label>

            <label htmlFor="name-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("register.name")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <input
                  id="name-input"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder={t("register.namePlaceholder")}
                />
              </div>
            </label>

            <label htmlFor="credential-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("login.credentialLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <input
                  id="credential-input"
                  name="credential"
                  type="text"
                  required
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder={t("login.credentialPlaceholder")}
                />
              </div>
            </label>

            <label htmlFor="password-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("login.passwordLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder={t("login.passwordPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("common.hide") : t("common.show")}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <span className="sr-only">{showPassword ? t("common.hide") : t("common.show")}</span>
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {errorMessage && (
              <p
                className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
                aria-live="polite"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending && (
                <div className="relative h-5 w-5 flex-shrink-0" aria-hidden="true">
                  <i className="absolute h-full w-full rounded-full border-2 border-b-current border-l-transparent border-r-transparent border-t-transparent border-solid animate-spinner-ease-spin" />
                  <i className="absolute h-full w-full rounded-full border-2 border-b-current border-l-transparent border-r-transparent border-t-transparent border-dotted opacity-75 animate-spinner-linear-spin" />
                </div>
              )}
              <span>{isPending ? t("register.signingUp") : t("register.signUp")}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
             {t("register.hasAccount")}{" "}
            <a
              href="/login"
              className="font-semibold text-primary transition hover:underline"
            >
              {t("register.login")}
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
