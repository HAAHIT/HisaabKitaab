"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import GlobalSearch from "@/components/search/GlobalSearch";

interface UserSession {
  userId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

export default function AppShellWrapper({
  children,
  user,
  showOnboarding = false,
  initialBusinessName,
}: {
  children: React.ReactNode;
  user: UserSession;
  showOnboarding?: boolean;
  initialBusinessName?: string;
}) {
  const router = useRouter();
  const [wizardVisible, setWizardVisible] = useState(showOnboarding);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-critical; app continues without offline support
      });
    }
  }, []);

  function handleOnboardingComplete() {
    setWizardVisible(false);
    router.refresh();
  }

  return (
    <AppShell user={user}>
      <GlobalSearch />
      {wizardVisible && (
        // z-[300] must exceed AppShell header (z-index: 200).
        // No overflow-y-auto here — SetupWizard manages its own internal scroll.
        <div className="fixed inset-0 z-[300]">
          <SetupWizard onComplete={handleOnboardingComplete} initialBusinessName={initialBusinessName} />
        </div>
      )}
      {children}
    </AppShell>
  );
}
