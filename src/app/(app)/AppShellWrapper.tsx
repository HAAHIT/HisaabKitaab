"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import { ProductTour } from "@/components/onboarding/ProductTour";
import GlobalSearch from "@/components/search/GlobalSearch";
import { QuotaProvider } from "@/components/billing/QuotaProvider";

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
  showTour = false,
  initialBusinessName,
}: {
  children: React.ReactNode;
  user: UserSession;
  showOnboarding?: boolean;
  showTour?: boolean;
  initialBusinessName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [wizardVisible, setWizardVisible] = useState(showOnboarding);
  const [tourVisible, setTourVisible] = useState(showTour);

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

  async function handleTourFinish() {
    setTourVisible(false);
    try {
      await fetch("/api/onboarding/tour-complete", { method: "POST" });
    } catch {
      // Non-fatal — user already saw the tour, server will retry next visit
    }
  }

  if (wizardVisible) {
    return (
      <SetupWizard
        onComplete={handleOnboardingComplete}
        initialBusinessName={initialBusinessName}
      />
    );
  }

  // Only show tour on the dashboard (target nav elements are in the shell)
  const showTourNow = tourVisible && pathname === "/dashboard";

  return (
    <AppShell user={user}>
      <GlobalSearch />
      <QuotaProvider />
      {children}
      {showTourNow && <ProductTour onFinish={handleTourFinish} />}
    </AppShell>
  );
}
