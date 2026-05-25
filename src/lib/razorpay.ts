/**
 * Razorpay client — server-only helpers for creating subscriptions,
 * verifying webhook signatures, and managing the customer lifecycle.
 *
 * Environment variables required:
 *   RAZORPAY_KEY_ID         — public key (also used client-side)
 *   RAZORPAY_KEY_SECRET     — server-only, never expose
 *   RAZORPAY_WEBHOOK_SECRET — used to verify webhook authenticity
 *   RAZORPAY_PRO_PLAN_ID    — pre-created plan_xxx for Pakka (₹299/mo)
 *   RAZORPAY_PRO_PLUS_PLAN_ID — pre-created plan_xxx for Bada (₹799/mo)
 *
 * Plan IDs are created via the Razorpay dashboard (Subscriptions → Plans)
 * and pasted here. We don't auto-create them — keeps secrets out of code.
 */

import crypto from "crypto";
import type { TenantPlan } from "@prisma/client";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new Error("Razorpay env vars missing: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function planIdFor(plan: Exclude<TenantPlan, "FREE">): string {
  const id = plan === "PRO"
    ? process.env.RAZORPAY_PRO_PLAN_ID
    : process.env.RAZORPAY_PRO_PLUS_PLAN_ID;
  if (!id) {
    throw new Error(`Razorpay plan ID missing for ${plan}. Configure RAZORPAY_${plan}_PLAN_ID.`);
  }
  return id;
}

/**
 * Create a Razorpay subscription. Customer pays at first billing event;
 * we get a webhook (subscription.activated) that flips the tenant's plan.
 */
export async function createSubscription(args: {
  plan: Exclude<TenantPlan, "FREE">;
  totalCount: number;       // billing cycles to charge (12 for annual)
  customerNotify?: boolean; // send Razorpay's email/SMS receipts
  notes?: Record<string, string>;
}): Promise<{ id: string; short_url: string; status: string }> {
  const res = await fetch(`${RAZORPAY_API}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planIdFor(args.plan),
      total_count: args.totalCount,
      customer_notify: args.customerNotify ? 1 : 0,
      notes: args.notes ?? {},
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Razorpay subscription create failed: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return { id: json.id, short_url: json.short_url, status: json.status };
}

/**
 * Cancel a subscription at end of current billing cycle. Tenant keeps
 * access until planExpiresAt; webhook downgrades the row.
 */
export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true): Promise<void> {
  const res = await fetch(
    `${RAZORPAY_API}/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Razorpay subscription cancel failed: ${res.status} ${errText}`);
  }
}

/**
 * Verify a webhook signature so we don't trust spoofed plan upgrades.
 * Razorpay sends `x-razorpay-signature` header — HMAC-SHA256 of the
 * raw request body using RAZORPAY_WEBHOOK_SECRET.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // timingSafeEqual to avoid timing attacks
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
