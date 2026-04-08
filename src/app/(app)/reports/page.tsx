import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { getCurrentFinancialYearRange } from "@/lib/journal-reporting";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

/**
 * Server-side page component that prepares report data and renders the ReportsClient.
 *
 * Performs authentication and authorization checks: redirects to `/login` if no session
 * is present and to `/dashboard` if the user's role is not `ADMIN` or `ACCOUNTANT`.
 * Fetches the tenant ID, computes the current financial year range, counts total and
 * unbalanced journal entries for the tenant, and retrieves active, non-deleted parties.
 *
 * @returns A React element rendering `ReportsClient` initialized with `initialFrom` and
 * `initialTo` (current financial year range), `totalEntries`, `unbalancedCount`, and `parties`.
 */
export default async function ReportsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN" && session.role !== "ACCOUNTANT") {
    redirect("/dashboard");
  }

  const tenantId = await getTenantId();
  const initialRange = getCurrentFinancialYearRange();

  const [totalEntries, unbalancedCount, parties] = await Promise.all([
    prisma.journalEntry.count({
      where: { tenantId },
    }),
    prisma.journalEntry.count({
      where: { tenantId, isBalanced: false },
    }),
    prisma.party.findMany({
      where: {
        tenantId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ReportsClient
      initialFrom={initialRange.from}
      initialTo={initialRange.to}
      totalEntries={totalEntries}
      unbalancedCount={unbalancedCount}
      parties={parties}
    />
  );
}
