"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n/translations";

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  const router = useRouter();

  return (
    <LanguageProvider key={initialLanguage} initialLanguage={initialLanguage}>
      <HeroUIProvider navigate={router.push}>
        {children}
      </HeroUIProvider>
    </LanguageProvider>
  );
}
