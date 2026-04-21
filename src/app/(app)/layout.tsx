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
  // Only show wizard when onboardingComplete is explicitly false (set at registration).
  // Legacy tenants without this key should NOT see the wizard.
  const showOnboarding = settings?.onboardingComplete === false;

  return (
    <AppShellWrapper user={session} showOnboarding={showOnboarding}>
      {children}
    </AppShellWrapper>
  );
}
