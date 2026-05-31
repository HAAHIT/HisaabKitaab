"use client";

import { useEffect } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import type { Language } from "@/lib/i18n/translations";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";

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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ConfirmProvider>
          {children}
          <Toaster richColors position="bottom-right" />
        </ConfirmProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
