import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { buildWhatsAppReminderUrl, type ReminderLanguage } from "@/lib/phone";

/**
 * POST /api/parties/remind-overdue
 *
 * Returns the list of overdue parties (those where customers owe us money,
 * i.e. currentBalance < 0 for CUSTOMER type) with pre-built WhatsApp reminder
 * URLs using the tenant's preferred reminder language.
 *
 * Does NOT send messages — it returns URLs that the client opens in new tabs
 * so the business owner controls every message before it is sent.
 *
 * Access: ADMIN and STAFF only.
 */
export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate-limit: max 10 bulk reminder fetches per minute per tenant
  const rateLimitResponse = await checkRateLimit(request, `remind-overdue:${tenantId}`, 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Fetch tenant for name + reminder language preference
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, reminderLanguage: true },
    });

    const tenantName = tenant?.name ?? undefined;
    const language = (tenant?.reminderLanguage ?? "hinglish") as ReminderLanguage;

    // Customers where currentBalance < 0 means they owe us (normal for CUSTOMER)
    // Exclude parties without a phone number — can't WhatsApp them
    const overdueParties = await prisma.party.findMany({
      where: {
        tenantId,
        isDeleted: false,
        isActive: true,
        type: "CUSTOMER",
        // currentBalance < 0 means they owe us (debit balance for Sundry Debtors)
        currentBalance: { lt: 0 },
        phone: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        currentBalance: true,
      },
      orderBy: { currentBalance: "asc" }, // most overdue first
    });

    const parties = overdueParties.map((p) => {
      const balanceAmount = Math.abs(p.currentBalance.toNumber());
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        balanceAmount,
        waUrl: buildWhatsAppReminderUrl({
          phone: p.phone!,
          partyName: p.name,
          balanceAmount,
          tenantName,
          language,
        }),
      };
    });

    logInfo("parties.remind-overdue.fetched", {
      requestId: getRequestId(request),
      tenantId,
      count: parties.length,
      language,
    });

    return NextResponse.json({
      parties,
      language,
      totalAmount: parties.reduce((s, p) => s + p.balanceAmount, 0),
    });
  } catch (error) {
    logError("parties.remind-overdue.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
