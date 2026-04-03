"use client";

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
  return <AppShell user={user}>{children}</AppShell>;
}
