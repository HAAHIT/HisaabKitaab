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

/**
 * Wraps provided children with the AppShell layout and, when running in production and supported by the browser, attempts to register the service worker at `/sw.js`.
 *
 * If service worker registration fails, the error is logged to the console.
 *
 * @param children - Content to render inside the AppShell
 * @param user - UserSession object forwarded to AppShell
 * @returns The AppShell element containing the given `children` and `user`
 */
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

  return <AppShell user={user}>{children}</AppShell>;
}
