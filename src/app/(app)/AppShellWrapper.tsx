"use client";

import { useEffect } from "react";
import AppShell from "@/components/ui/AppShell";

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
}: {
  children: React.ReactNode;
  user: UserSession;
}) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, []);

  return <AppShell user={user}>{children}</AppShell>;
}
