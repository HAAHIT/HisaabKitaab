import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { getCurrentFinancialYearRange } from "@/lib/journal-reporting";
import { CHART_OF_ACCOUNTS, isBusinessFacingAccount } from "@/lib/chart-of-accounts";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

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
      where: { tenantId, isDeleted: false },
    }),
    prisma.journalEntry.count({
      where: { tenantId, isBalanced: false, isDeleted: false },
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

  const accountOptions = Object.values(CHART_OF_ACCOUNTS)
    .map((a) => ({
      code: a.code,
      name: a.name,
      tallyGroup: a.tallyGroup,
      businessFacing: isBusinessFacingAccount(a.code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ReportsClient
      initialFrom={initialRange.from}
      initialTo={initialRange.to}
      totalEntries={totalEntries}
      unbalancedCount={unbalancedCount}
      parties={parties}
      accountOptions={accountOptions}
    />
  );
}
