import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.role !== "SUPERADMIN") redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div style={{ minHeight: "100vh", background: "var(--sb-bg)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--sb-border)",
          background: "var(--sb-card)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--sb-text)" }}>
          SoloBooks Platform Admin
        </div>
        <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
          <Link href="/admin/stats" style={{ color: "var(--sb-text)" }}>
            Overview
          </Link>
          <Link href="/admin/stats/tenants" style={{ color: "var(--sb-text)" }}>
            Tenants
          </Link>
          <Link href="/admin/stats/activity" style={{ color: "var(--sb-text)" }}>
            Activity
          </Link>
          <Link href="/admin/plans" style={{ color: "var(--sb-text)" }}>
            Plans
          </Link>
          <Link href="/admin/health" style={{ color: "var(--sb-text)" }}>
            Health
          </Link>
          <Link href="/admin/search" style={{ color: "var(--sb-text)" }}>
            Search
          </Link>
          <Link href="/admin/superadmins" style={{ color: "var(--sb-text)" }}>
            Superadmins
          </Link>
        </nav>
        <a
          href="/api/auth/logout"
          style={{
            marginLeft: "auto",
            border: "1px solid var(--sb-border)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 13,
            color: "var(--sb-text)",
            textDecoration: "none",
          }}
        >
          Sign out
        </a>
      </header>
      <main style={{ padding: "24px", maxWidth: 1440, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
