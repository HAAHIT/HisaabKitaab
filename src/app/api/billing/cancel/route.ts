import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { cancelSubscription } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * POST /api/billing/cancel
 *
 * Cancels the tenant's active subscription at the end of the current
 * billing cycle. They keep access until planExpiresAt, then the
 * `subscription.completed` webhook downgrades them to FREE.
 *
 * ADMIN only.
 */
export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(request, "billing.cancel", 5);
  if (rl) return rl;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Only ADMIN can manage billing" }, { status: 403 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { razorpaySubscriptionId: true, subscriptionStatus: true },
    });
    if (!tenant?.razorpaySubscriptionId) {
      return NextResponse.json({ error: "No active subscription to cancel" }, { status: 404 });
    }
    if (tenant.subscriptionStatus === "CANCELLED") {
      return NextResponse.json({ error: "Subscription is already cancelled" }, { status: 409 });
    }

    await cancelSubscription(tenant.razorpaySubscriptionId, true);

    // Webhook will update status; we record the intent immediately so the UI
    // can show "cancellation scheduled" without waiting for the round-trip.
    await prisma.subscriptionEvent.create({
      data: {
        tenantId,
        eventType: "manual.cancel_requested",
        razorpayId: tenant.razorpaySubscriptionId,
      },
    });

    logInfo("billing.cancel.requested", {
      requestId: getRequestId(request),
      tenantId,
      subscriptionId: tenant.razorpaySubscriptionId,
    });

    return NextResponse.json({
      ok: true,
      message: "Subscription will end at the end of the current billing cycle.",
    });
  } catch (error) {
    logError("billing.cancel.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
