import { cookies } from "next/headers";
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
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-blue-600">
              DoorCraft Pro
            </h1>
            <p className="text-sm text-default-500">{t("login.subtitle")}</p>
          </div>
        </div>

        <div className="border-t border-default-100 px-6 pb-8 pt-5 dark:border-zinc-800">
          <div className="mb-5 flex justify-end">
            <a
              href={languageSwitchUrl}
              className="inline-flex min-h-10 min-w-16 items-center justify-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              {nextLanguage.toUpperCase()}
            </a>
          </div>

          <form
            action="/api/auth/login"
            method="post"
            className="flex flex-col gap-4"
          >
            <label htmlFor="credential-input" className="space-y-1.5">
              <span className="text-sm font-medium text-default-700">
                {t("login.credentialLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-default-200 bg-background px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <svg
                  className="h-5 w-5 shrink-0 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <input
                  id="credential-input"
                  name="credential"
                  type="text"
                  autoComplete="username"
                  className="w-full bg-transparent text-base outline-none placeholder:text-default-400"
                  placeholder={t("login.credentialPlaceholder")}
                />
              </div>
            </label>

            <label htmlFor="password-input" className="space-y-1.5">
              <span className="text-sm font-medium text-default-700">
                {t("login.passwordLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-default-200 bg-background px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <svg
                  className="h-5 w-5 shrink-0 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-base outline-none placeholder:text-default-400"
                  placeholder={t("login.passwordPlaceholder")}
                />
                <button
                  id="password-toggle"
                  type="button"
                  aria-controls="password-input"
                  aria-pressed="false"
                  data-show-label={t("common.show")}
                  data-hide-label={t("common.hide")}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-default-500 transition hover:bg-default-100 hover:text-default-700"
                >
                  {t("common.show")}
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
              id="login-button"
              type="submit"
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95"
            >
              {t("login.signIn")}
            </button>

            <details className="rounded-xl border border-default-200 bg-default-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer list-none font-medium text-primary">
                {t("login.forgotPassword")}
              </summary>
              <p className="mt-3 text-default-600">
                {t("login.forgotPasswordBody")}
              </p>
            </details>
          </form>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const input = document.getElementById("password-input");
              const toggle = document.getElementById("password-toggle");
              if (!input || !toggle) return;
              toggle.addEventListener("click", () => {
                const nextVisible = input.type === "password";
                input.type = nextVisible ? "text" : "password";
                toggle.setAttribute("aria-pressed", String(nextVisible));
                toggle.textContent = nextVisible
                  ? toggle.getAttribute("data-hide-label") || "Hide"
                  : toggle.getAttribute("data-show-label") || "Show";
              });
            })();
          `,
        }}
      />
    </div>
  );
}
