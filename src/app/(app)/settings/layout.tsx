import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/ui/SettingsShell";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <SettingsShell>{children}</SettingsShell>;
}
