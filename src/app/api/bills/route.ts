import { prisma } from "@/lib/prisma";
import {
  buildBillSnapshotFromParty,
  getPostedBillBalanceDelta,
} from "@/lib/accounting";
import { NextRequest, NextResponse } from "next/server";

const BILL_NUMBER_LOCK_KEY = 22032026;

type TenantBillingSettingsRow = {
  id: string;
  settings: unknown;
  createdAt: Date;
};

function parseTenantSettings(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function resolveTenantId(request: NextRequest) {
  return (
    request.headers.get("x-tenant-id")?.trim() ||
    process.env.DEFAULT_TENANT_ID?.trim() ||
    null
  );
}

async function loadBillingSettings(request: NextRequest) {
  const scopedTenantId = resolveTenantId(request);

  let tenantRows: TenantBillingSettingsRow[] = [];
  if (scopedTenantId) {
    tenantRows = await prisma.$queryRaw<TenantBillingSettingsRow[]>`
      SELECT "id", "settings", "createdAt"
      FROM "Tenant"
      WHERE "id" = ${scopedTenantId}
      LIMIT 1
    `;
  }

  if (!tenantRows[0]) {
    tenantRows = await prisma.$queryRaw<TenantBillingSettingsRow[]>`
      SELECT "id", "settings", "createdAt"
      FROM "Tenant"
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
  }

  const tenantSettings = parseTenantSettings(tenantRows[0]?.settings);
  const billPrefixCandidate =
    typeof tenantSettings.billPrefix === "string"
      ? tenantSettings.billPrefix.trim()
      : "";
  const defaultTaxPercentRaw = tenantSettings.defaultTaxPercent;
  const defaultTaxPercent =
    typeof defaultTaxPercentRaw === "number"
      ? defaultTaxPercentRaw
      : typeof defaultTaxPercentRaw === "string"
        ? Number.parseFloat(defaultTaxPercentRaw)
        : Number.NaN;

  return {
    billPrefix: billPrefixCandidate || "BILL",
    defaultTaxPercent: Number.isFinite(defaultTaxPercent)
      ? defaultTaxPercent
      : 0,
  };
}

// GET /api/bills — List bills with filtering
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const partyId = searchParams.get("partyId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isDeleted: false };

    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (partyId) {
      where.partyId = partyId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          billNumber: true,
          partyId: true,
          party: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.bill.count({ where }),
    ]);

    return NextResponse.json({
      bills,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("List bills error:", error);
    return NextResponse.json(
      { error: "Failed to load bills" },
      { status: 500 }
    );
  }
}

// POST /api/bills — Create a new bill
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");
  const tenantId = resolveTenantId(request);

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context missing. Set x-tenant-id or DEFAULT_TENANT_ID." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      templateId,
      partyId,
      customerName,
      customerPhone,
      customerAddress,
      gstin,
      rows,
      notes,
      terms,
      taxPercent,
      subtotal,
      taxAmount,
      grandTotal,
      status,
    } = body;

    if (!templateId || !partyId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Template, party, and at least one row are required" },
        { status: 400 }
      );
    }

    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        gstin: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const billingSettings = await loadBillingSettings(request);
    const prefix = billingSettings.billPrefix;
    const resolvedGrandTotal =
      typeof grandTotal === "number" && Number.isFinite(grandTotal)
        ? grandTotal
        : 0;
    const billStatus = status === "FINAL" ? "FINAL" : "DRAFT";
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const snapshot = buildBillSnapshotFromParty(party, {
      customerName,
      customerPhone,
      customerAddress,
      gstin,
    });

    const bill = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BILL_NUMBER_LOCK_KEY})`;

      const existingCountRows = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Bill"
        WHERE
          "tenantId" = ${tenantId}
          AND "createdAt" >= ${monthStart}
          AND "createdAt" < ${nextMonthStart}
      `;
      const existingCount = Number(existingCountRows[0]?.count || 0);
      const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

      const billId = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "Bill" (
          "id",
          "tenantId",
          "billNumber",
          "templateId",
          "partyId",
          "customerName",
          "customerPhone",
          "customerAddress",
          "gstin",
          "rows",
          "notes",
          "terms",
          "subtotal",
          "taxPercent",
          "taxAmount",
          "grandTotal",
          "status",
          "createdBy",
          "createdAt",
          "updatedAt",
          "isDeleted"
        )
        VALUES (
          ${billId},
          ${tenantId},
          ${billNumber},
          ${templateId},
          ${party.id},
          ${snapshot.customerName},
          ${snapshot.customerPhone},
          ${snapshot.customerAddress},
          ${snapshot.gstin},
          ${JSON.stringify(rows)}::jsonb,
          ${notes || null},
          ${terms || null},
          ${subtotal || 0},
          ${taxPercent ?? billingSettings.defaultTaxPercent},
          ${taxAmount || 0},
          ${resolvedGrandTotal},
          ${billStatus}::"BillStatus",
          ${userId},
          NOW(),
          NOW(),
          false
        )
      `;

      const createdBill = await tx.bill.findUnique({
        where: { id: billId },
      });

      if (!createdBill) {
        throw new Error("Failed to create bill");
      }

      const balanceChange = getPostedBillBalanceDelta(
        party.type,
        billStatus,
        resolvedGrandTotal
      );

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      return createdBill;
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    console.error("Create bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
