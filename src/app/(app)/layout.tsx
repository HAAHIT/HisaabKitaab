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
    select: { settings: true, isOnboardingComplete: true },
  });

  const settings = tenant?.settings as Record<string, unknown> | null;
  // Show wizard only when the tenant column says onboarding is incomplete.
  // /api/onboarding/complete writes to this column.
  const showOnboarding = tenant?.isOnboardingComplete === false;
  const initialBusinessName =
    typeof settings?.companyName === "string" ? (settings.companyName as string) : undefined;

  return (
    <AppShellWrapper
      user={session}
      showOnboarding={showOnboarding}
      initialBusinessName={initialBusinessName}
    >
      {children}
    </AppShellWrapper>
  );
}
