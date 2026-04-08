"use client";

import { HeroUIProvider } from "@heroui/react";
import { useEffect } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n/translations";

/**
 * Wraps `children` with language and UI providers and, in non-production browsers that support service workers, clears existing service worker registrations and cache entries on mount.
 *
 * The component initializes the language context using `initialLanguage` and provides UI theming via `HeroUIProvider`.
 *
 * @param initialLanguage - The language value used to initialize the LanguageProvider
 * @param children - React nodes to render inside the providers
 * @returns The provided `children` wrapped by `LanguageProvider` and `HeroUIProvider`
 */
export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });

    if ("caches" in window) {
      void caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          void caches.delete(cacheName);
        });
      });
    }
  }, []);

  return (
    <LanguageProvider key={initialLanguage} initialLanguage={initialLanguage}>
      <HeroUIProvider>{children}</HeroUIProvider>
    </LanguageProvider>
  );
}
