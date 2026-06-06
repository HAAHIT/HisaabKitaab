import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createSubscription } from "@/lib/razorpay";

export const runtime = "nodejs";

const SubscribeSchema = z.object({
  plan: z.enum(["PRO", "PRO_PLUS"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

/**
 * POST /api/billing/subscribe
 *
 * Creates a Razorpay subscription and returns its short_url. The client
 * redirects the user to the URL (or opens Razorpay's hosted Checkout).
 * Once paid, the `subscription.activated` webhook flips the tenant's plan.
 *
 * ADMIN only — billing is an owner action.
 */
export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(request, "billing.subscribe", 10);
  if (rl) return rl;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Only ADMIN can manage billing" }, { status: 403 });
  }

  try {
    const body = SubscribeSchema.parse(await request.json());

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, email: true, razorpaySubscriptionId: true, subscriptionStatus: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Block double-subscription: if an active subscription already exists,
    // direct the user to manage it rather than creating a second one.
    if (tenant.razorpaySubscriptionId && tenant.subscriptionStatus === "ACTIVE") {
      return NextResponse.json(
        { error: "An active subscription already exists. Cancel it first to switch plans." },
        { status: 409 }
      );
    }

    // total_count is the number of billing cycles. We charge 12 for annual,
    // 60 for monthly (5 years before auto-renewal prompt — Razorpay limit).
    const totalCount = body.cycle === "yearly" ? 12 : 60;

    const subscription = await createSubscription({
      plan: body.plan,
      totalCount,
      customerNotify: true,
      notes: { tenantId: tenant.id, tenantName: tenant.name },
    });

    // Persist subscription id immediately so even if user abandons checkout
    // and comes back later, we can resume from the same subscription.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        razorpaySubscriptionId: subscription.id,
        // Status flips to ACTIVE only when webhook confirms payment;
        // PAST_DUE is the safest placeholder while we wait.
        subscriptionStatus: "PAST_DUE",
      },
    });

    // Deterministic idempotency key (matches the webhook convention) so a
    // retried create for the same subscription can't insert a duplicate row.
    await prisma.subscriptionEvent.create({
      data: {
        tenantId,
        eventType: "subscription.created",
        toPlan: body.plan,
        razorpayId: subscription.id,
        idempotencyKey: `subscription.created:${subscription.id}`,
        payload: { cycle: body.cycle, totalCount, short_url: subscription.short_url },
      },
    });

    logInfo("billing.subscribe.created", {
      requestId: getRequestId(request),
      tenantId,
      subscriptionId: subscription.id,
      plan: body.plan,
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      checkoutUrl: subscription.short_url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 });
    }
    logError("billing.subscribe.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
