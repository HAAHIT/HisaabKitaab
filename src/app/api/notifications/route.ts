import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { getIstCalendar } from "@/lib/journal-reporting";

export const runtime = "nodejs";

interface NotificationItem {
  id: string;
  kind: "OVERDUE_BILLS" | "DRAFT_BILLS" | "UNBALANCED_ENTRIES" | "GST_FILING_DUE" | "MISSING_GSTIN";
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  href?: string;
  meta?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ data: { items: [], count: 0 } });
  }

  try {
    const now = new Date();
    const ist = getIstCalendar(now);
    const startOfMonth = new Date(Date.UTC(ist.year, ist.month, 1, -5, -30, 0, 0));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [overdueBills, draftBills, unbalancedCount, tenant] = await Promise.all([
      // Bills > 30 days old that are still FINAL with outstanding balance
      prisma.bill.findMany({
        where: {
          tenantId,
          isDeleted: false,
          status: "FINAL",
          date: { lte: thirtyDaysAgo },
        },
        select: {
          id: true,
          billNumber: true,
          grandTotal: true,
          customerName: true,
          date: true,
          payments: {
            where: { isDeleted: false, status: "COMPLETED" },
            select: { amount: true },
          },
        },
        take: 200,
      }),
      prisma.bill.count({
        where: {
          tenantId,
          isDeleted: false,
          status: "DRAFT",
          date: { lte: sevenDaysAgo },
        },
      }),
      prisma.journalEntry.count({
        where: { tenantId, isDeleted: false, isBalanced: false },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { gstin: true },
      }),
    ]);

    const items: NotificationItem[] = [];

    let trulyOverdue = 0;
    let overdueTotal = 0;
    for (const b of overdueBills) {
      const paid = b.payments.reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Number(b.grandTotal) - paid;
      if (outstanding > 0.01) {
        trulyOverdue += 1;
        overdueTotal += outstanding;
      }
    }
    if (trulyOverdue > 0) {
      items.push({
        id: "overdue-bills",
        kind: "OVERDUE_BILLS",
        severity: "danger",
        title: `${trulyOverdue} overdue invoice${trulyOverdue > 1 ? "s" : ""}`,
        message: `Total outstanding over 30 days: ₹${overdueTotal.toFixed(2)}`,
        href: "/reports",
        meta: { count: trulyOverdue, total: overdueTotal },
      });
    }

    if (draftBills > 0) {
      items.push({
        id: "draft-bills",
        kind: "DRAFT_BILLS",
        severity: "warning",
        title: `${draftBills} draft bill${draftBills > 1 ? "s" : ""} pending`,
        message: "Draft bills older than 7 days. Finalise or delete.",
        href: "/bills?status=DRAFT",
      });
    }

    if (unbalancedCount > 0) {
      items.push({
        id: "unbalanced-entries",
        kind: "UNBALANCED_ENTRIES",
        severity: "danger",
        title: `${unbalancedCount} unbalanced journal entries`,
        message: "Exports and Tally sync are blocked until these are fixed.",
        href: "/reports",
      });
    }

    // GST filing reminder: between 11th and 20th of month (GSTR-3B due 20th).
    if (ist.day >= 11 && ist.day <= 20 && tenant?.gstin) {
      const prevMonth = ist.month === 0 ? 11 : ist.month - 1;
      const prevMonthName = new Date(Date.UTC(2025, prevMonth, 1)).toLocaleString("en-US", {
        month: "long",
      });
      items.push({
        id: "gst-filing-due",
        kind: "GST_FILING_DUE",
        severity: "warning",
        title: `GSTR-3B for ${prevMonthName} due by 20th`,
        message: "Download GSTR-1 and GSTR-3B JSON from Reports.",
        href: "/reports",
      });
    }

    if (!tenant?.gstin && role === "ADMIN") {
      items.push({
        id: "missing-gstin",
        kind: "MISSING_GSTIN",
        severity: "info",
        title: "Business GSTIN not set",
        message: "Add your GSTIN under Business Profile for accurate GST reports.",
        href: "/settings/company",
      });
    }

    // Acknowledge startOfMonth use to silence unused-warning while keeping context.
    void startOfMonth;

    return NextResponse.json({
      data: { items, count: items.length },
    });
  } catch (error) {
    logError("notifications.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to compute notifications" },
      { status: 500 }
    );
  }
}
