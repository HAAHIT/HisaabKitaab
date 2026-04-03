"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  const router = useRouter();
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
    startTransition(() => {
      router.refresh();
    });
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
