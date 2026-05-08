import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

/** GET /api/bank-accounts — list active bank accounts for the tenant */
export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId } = sessionResolution.session;

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { tenantId, isDeleted: false, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        accountNumber: true,
        openingBalance: true,
        currentBalance: true,
        isDefault: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    logError("bank-accounts.list.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/bank-accounts — create a new bank account */
export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit(request, `bank-accounts:create:${tenantId}`, 20);
  if (rl) return rl;

  let body: {
    name?: unknown;
    accountNumber?: unknown;
    openingBalance?: unknown;
    type?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Bank account name is required" }, { status: 400 });
  }

  const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : null;
  const openingBalance = Number(body.openingBalance) || 0;
  // Always BANK type for bank accounts created via onboarding
  const type = body.type === "CASH" ? "CASH" as const : "BANK" as const;

  try {
    const existing = await prisma.bankAccount.findFirst({
      where: { tenantId, name, isDeleted: false },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: `Bank account "${name}" already exists` }, { status: 409 });
    }

    const account = await prisma.bankAccount.create({
      data: {
        tenantId,
        name,
        type,
        accountNumber: accountNumber || null,
        openingBalance,
        currentBalance: openingBalance,
        createdBy: userId,
        updatedAt: new Date(),
      },
      select: { id: true, name: true, type: true, accountNumber: true, openingBalance: true },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    logError("bank-accounts.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
