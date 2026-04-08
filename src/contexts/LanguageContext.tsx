"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createTranslator,
  getTranslation,
  Language,
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_STORAGE_KEY,
  TranslationKey,
} from "@/lib/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function persistLanguagePreference(language: Language) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Provides language selection context to descendants and manages language state, persistence, and navigation when the language changes.
 *
 * Persists the selected language, updates the translator used by consumers, and navigates to the language preference endpoint including a `returnTo` parameter derived from the current location (falls back to `/dashboard` if missing).
 *
 * @param children - React nodes to render within the provider
 * @param initialLanguage - Language to initialize the provider with
 * @returns A React context provider that supplies `{ language, setLanguage, t }` to its children
 */
export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    persistLanguagePreference(language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    if (lang === language) {
      return;
    }

    setLanguageState(lang);
    persistLanguagePreference(lang);
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = `/api/preferences/language?lang=${lang}&returnTo=${encodeURIComponent(returnTo || "/dashboard")}`;
    window.location.assign(target);
  };

  const t = useMemo(() => createTranslator(language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export function useStaticTranslation(language: Language, key: TranslationKey) {
  return getTranslation(language, key);
}
