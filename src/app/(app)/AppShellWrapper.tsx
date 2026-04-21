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
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, []);

  // Force full reload on browser back/forward to bust Next.js router cache
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("popstate", reload);
    return () => window.removeEventListener("popstate", reload);
  }, []);

  return <AppShell user={user}>{children}</AppShell>;
}
