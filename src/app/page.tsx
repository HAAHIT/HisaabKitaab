import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    const redirectPath =
      session.role === "SUPERADMIN"
        ? "/admin/stats"
        : session.role === "CUSTOMER"
          ? "/measurements/upload"
          : "/dashboard";
    redirect(redirectPath);
  }
  return <LandingPage />;
}
