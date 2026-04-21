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
              HisaabKitaab
            </h1>
            <p className="text-sm text-gray-400 dark:text-zinc-400">{t("login.subtitle")}</p>
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

          <form
            action="/api/auth/login"
            method="post"
            className="flex flex-col gap-4"
          >
            <label htmlFor="credential-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("login.credentialLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 dark:text-zinc-500"
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
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 [&:-webkit-autofill]:![box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:![-webkit-text-fill-color:#111827] dark:[&:-webkit-autofill]:![box-shadow:0_0_0_1000px_#3f3f46_inset] dark:[&:-webkit-autofill]:![-webkit-text-fill-color:#f4f4f5]"
                  placeholder={t("login.credentialPlaceholder")}
                />
              </div>
            </label>

            <label htmlFor="password-input" className="space-y-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                {t("login.passwordLabel")}
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 dark:text-zinc-500"
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
                  className="w-full bg-transparent text-base outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 [&:-webkit-autofill]:![box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:![-webkit-text-fill-color:#111827] dark:[&:-webkit-autofill]:![box-shadow:0_0_0_1000px_#3f3f46_inset] dark:[&:-webkit-autofill]:![-webkit-text-fill-color:#f4f4f5]"
                  placeholder={t("login.passwordPlaceholder")}
                />
                <button
                  id="password-toggle"
                  type="button"
                  aria-controls="password-input"
                  aria-pressed="false"
                  data-show-label={t("common.show")}
                  data-hide-label={t("common.hide")}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <span className="sr-only">{t("common.show")}</span>
                  <svg
                    id="password-icon-hidden"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <svg
                    id="password-icon-visible"
                    className="hidden h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
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
              className="mt-2 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div id="login-spinner" className="relative hidden h-5 w-5 flex-shrink-0" aria-hidden="true">
                <i className="absolute h-full w-full rounded-full border-2 border-b-current border-l-transparent border-r-transparent border-t-transparent border-solid animate-spinner-ease-spin" />
                <i className="absolute h-full w-full rounded-full border-2 border-b-current border-l-transparent border-r-transparent border-t-transparent border-dotted opacity-75 animate-spinner-linear-spin" />
              </div>
              <span id="login-label">{t("login.signIn")}</span>
            </button>

            <button
              id="forgot-password-trigger"
              type="button"
              className="text-center text-sm font-medium text-primary transition hover:underline"
            >
              {t("login.forgotPassword")}
            </button>
          </form>
        </div>
      </div>

      <dialog
        id="forgot-password-dialog"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 m-0 w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-white/60 bg-white p-0 text-left text-foreground shadow-2xl shadow-blue-950/15 backdrop:bg-black/35 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-foreground">
            {t("login.forgotPasswordTitle")}
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-gray-600 dark:text-zinc-400">
            {t("login.forgotPasswordBody")}
          </p>
        </div>
        <div className="flex justify-end border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
          <button
            id="forgot-password-close"
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
          >
            {t("common.ok")}
          </button>
        </div>
      </dialog>

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
              if (form && loginBtn && loginSpinner && loginLabel) {
                form.addEventListener("submit", () => {
                  loginBtn.setAttribute("disabled", "true");
                  loginSpinner.classList.remove("hidden");
                  loginSpinner.classList.add("flex");
                  loginLabel.textContent = "Signing in\u2026";
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
                    hiddenIcon.classList.toggle("hidden", nextVisible);
                    visibleIcon.classList.toggle("hidden", !nextVisible);
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
