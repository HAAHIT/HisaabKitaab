import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { settings: true },
  });

  const settings = tenant?.settings as Record<string, unknown> | null;
  const showOnboarding = !settings?.onboardingComplete;

  return (
    <AppShellWrapper user={session} showOnboarding={showOnboarding}>
      {children}
    </AppShellWrapper>
  );
}
