"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { LanguageProvider } from "@/contexts/LanguageContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <LanguageProvider>
      <HeroUIProvider navigate={router.push}>
        {children}
      </HeroUIProvider>
    </LanguageProvider>
  );
}
