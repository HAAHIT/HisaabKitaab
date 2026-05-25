import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo, logWarn, getRequestId } from "@/lib/observability";
import { verifyWebhookSignature } from "@/lib/razorpay";
import type { TenantPlan } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook
 *
 * Razorpay webhook receiver. Razorpay POSTs JSON for every subscription /
 * payment event. We verify the HMAC signature, then update the tenant's
 * plan and log every event into SubscriptionEvent for audit.
 *
 * Idempotency: Razorpay can deliver the same event multiple times. We
 * dedupe by razorpayId in SubscriptionEvent — if we've seen this event,
 * we 200 without re-applying it.
 *
 * No auth: signature verification is the auth.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      logWarn("billing.webhook.bad_signature", {
        requestId: getRequestId(request),
        bodyPreview: rawBody.slice(0, 200),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch (error) {
    logError("billing.webhook.signature_error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Signature verification failed" }, { status: 500 });
  }

  let event: {
    event: string;
    payload: {
      subscription?: { entity: { id: string; status: string; plan_id: string; current_end?: number; notes?: Record<string, string> } };
      payment?: { entity: { id: string; amount: number; status: string; subscription_id?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event;
  const subEntity = event.payload.subscription?.entity;
  const payEntity = event.payload.payment?.entity;
  const razorpayId = subEntity?.id ?? payEntity?.subscription_id ?? payEntity?.id;

  if (!razorpayId) {
    logWarn("billing.webhook.no_id", { requestId: getRequestId(request), eventType });
    return NextResponse.json({ received: true });
  }

  // Dedupe: have we already processed this exact event?
  const eventKey = `${eventType}:${razorpayId}:${payEntity?.id ?? "none"}`;
  const existing = await prisma.subscriptionEvent.findFirst({
    where: { eventType, razorpayId, payload: { path: ["eventKey"], equals: eventKey } },
    select: { id: true },
  });
  if (existing) {
    logInfo("billing.webhook.duplicate", { requestId: getRequestId(request), eventKey });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Resolve the tenant from subscription id
  const tenant = await prisma.tenant.findFirst({
    where: { razorpaySubscriptionId: razorpayId },
    select: { id: true, plan: true },
  });
  if (!tenant) {
    logWarn("billing.webhook.unknown_subscription", {
      requestId: getRequestId(request),
      razorpayId,
      eventType,
    });
    // 200 so Razorpay stops retrying — we genuinely don't know this subscription.
    return NextResponse.json({ received: true, unknown: true });
  }

  // Map the event to a plan change
  let newPlan: TenantPlan | null = null;
  let newStatus: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | null = null;
  let newExpiresAt: Date | null | undefined = undefined; // undefined = don't touch

  switch (eventType) {
    case "subscription.activated":
    case "subscription.charged":
      // Map Razorpay plan_id back to our plan via env lookup
      if (subEntity?.plan_id === process.env.RAZORPAY_PRO_PLUS_PLAN_ID) {
        newPlan = "PRO_PLUS";
      } else if (subEntity?.plan_id === process.env.RAZORPAY_PRO_PLAN_ID) {
        newPlan = "PRO";
      }
      newStatus = "ACTIVE";
      if (subEntity?.current_end) {
        newExpiresAt = new Date(subEntity.current_end * 1000);
      }
      break;

    case "subscription.pending":
    case "subscription.halted":
      newStatus = "PAST_DUE";
      break;

    case "subscription.cancelled":
      newStatus = "CANCELLED";
      // Keep plan + access until current_end; expiry job handles downgrade
      if (subEntity?.current_end) {
        newExpiresAt = new Date(subEntity.current_end * 1000);
      }
      break;

    case "subscription.completed":
    case "subscription.expired":
      newPlan = "FREE";
      newStatus = "EXPIRED";
      newExpiresAt = null;
      break;

    case "payment.failed":
      newStatus = "PAST_DUE";
      break;

    default:
      // Log but don't error — Razorpay sends many event types we don't care about.
      logInfo("billing.webhook.unhandled", {
        requestId: getRequestId(request),
        eventType,
        tenantId: tenant.id,
      });
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionEvent.create({
      data: {
        tenantId: tenant.id,
        eventType,
        fromPlan: tenant.plan,
        toPlan: newPlan ?? tenant.plan,
        amount: payEntity?.amount ?? null,
        razorpayId,
        payload: { eventKey, raw: event } as unknown as object,
      },
    });

    if (newPlan || newStatus || newExpiresAt !== undefined) {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(newPlan ? { plan: newPlan } : {}),
          ...(newStatus ? { subscriptionStatus: newStatus } : {}),
          ...(newExpiresAt !== undefined ? { planExpiresAt: newExpiresAt } : {}),
          // Clear trial once they're on a paid plan
          ...(newPlan && newPlan !== "FREE" ? { trialEndsAt: null } : {}),
        },
      });
    }
  });

  logInfo("billing.webhook.processed", {
    requestId: getRequestId(request),
    tenantId: tenant.id,
    eventType,
    newPlan,
    newStatus,
  });

  return NextResponse.json({ received: true });
}
