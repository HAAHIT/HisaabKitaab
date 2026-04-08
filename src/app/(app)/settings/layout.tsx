import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Restricts access to the settings layout to admin users and renders the provided children for authorized sessions.
 *
 * Fetches the current session; if no session exists, redirects to `/login`, and if the session exists but the role is not `"ADMIN"`, redirects to `/dashboard`.
 *
 * @param children - The UI to render when the current session exists and the user has the `"ADMIN"` role.
 * @returns The provided `children` when the user is authorized. 
 */
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

  return children;
}
