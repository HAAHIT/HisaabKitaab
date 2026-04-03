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

function isCompanySettingsTableMissing(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    error.code !== "P2021"
  ) {
    return false;
  }

  const tableName =
    "meta" in error &&
    error.meta &&
    typeof error.meta === "object" &&
    "table" in error.meta &&
    typeof error.meta.table === "string"
      ? error.meta.table
      : "";

  return tableName.includes("CompanySettings");
}

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

async function loadBillingSettings(request: NextRequest) {
  try {
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
      select: {
        billPrefix: true,
        defaultTaxPercent: true,
      },
    });

    return {
      billPrefix:
        settings?.billPrefix && settings.billPrefix.trim()
          ? settings.billPrefix.trim()
          : "BILL",
      defaultTaxPercent: settings?.defaultTaxPercent ?? 0,
    };
  } catch (error) {
    if (!isCompanySettingsTableMissing(error)) {
      throw error;
    }

    const scopedTenantId =
      request.headers.get("x-tenant-id")?.trim() ||
      process.env.DEFAULT_TENANT_ID?.trim() ||
      null;

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

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

      const existingCount = await tx.bill.count({
        where: {
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      });
      const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

      const createdBill = await tx.bill.create({
        data: {
          billNumber,
          templateId,
          partyId: party.id,
          ...snapshot,
          rows,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent ?? billingSettings.defaultTaxPercent,
          taxAmount: taxAmount || 0,
          grandTotal: resolvedGrandTotal,
          status: billStatus,
          createdBy: userId!,
        },
      });

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
