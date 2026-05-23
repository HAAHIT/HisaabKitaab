"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { SetupWizard } from "@/components/onboarding/SetupWizard";

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

  // Force full reload on browser back/forward to bust Next.js router cache
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("popstate", reload);
    return () => window.removeEventListener("popstate", reload);
  }, []);

  function handleOnboardingComplete() {
    setWizardVisible(false);
    router.refresh();
  }

  return (
    <AppShell user={user}>
      {wizardVisible && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-default-50 dark:bg-zinc-950">
          <SetupWizard onComplete={handleOnboardingComplete} initialBusinessName={initialBusinessName} />
        </div>
      )}
      {children}
    </AppShell>
  );
}
