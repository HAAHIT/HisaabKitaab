import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShellWrapper from "./AppShellWrapper";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShellWrapper
      user={session}
    >
      {children}
    </AppShellWrapper>
  );
}
