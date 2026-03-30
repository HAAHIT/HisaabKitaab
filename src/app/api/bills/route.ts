import { prisma } from "@/lib/prisma";
import {
  buildBillSnapshotFromParty,
  getPostedBillBalanceDelta,
  getPaymentBalanceDelta,
} from "@/lib/accounting";
import { getTenantId } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

const BILL_NUMBER_LOCK_KEY = 22032026;

// GET /api/bills — List bills with filtering
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const partyId = searchParams.get("partyId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId, isDeleted: false };

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
    const tenantId = await getTenantId();
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

    let finalTemplateId = templateId;
    const isQuickBill = templateId === "__QUICK_BILL__";

    if (isQuickBill) {
      if (!partyId) {
        return NextResponse.json({ error: "Party is required for Quick Bill" }, { status: 400 });
      }

      if (!grandTotal || grandTotal <= 0) {
        return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
      }

      let quickTemplate = await prisma.billTemplate.findFirst({
        where: { name: "__QUICK_BILL__", tenantId },
      });

      if (!quickTemplate) {
        quickTemplate = await prisma.billTemplate.create({
          data: {
            tenantId,
            name: "__QUICK_BILL__",
            columns: [
              { id: "desc", name: "Description", type: "text", position: 0 },
              { id: "amt", name: "Amount", type: "number", position: 1 },
            ],
            createdBy: userId!,
          },
        });
      }

      finalTemplateId = quickTemplate.id;
    }

    if (!finalTemplateId || !partyId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Template, party, and at least one row are required" },
        { status: 400 }
      );
    }

    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        tenantId,
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

    // Load tenant settings (replaces CompanySettings)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const prefix = (settings.billPrefix as string) || "BILL";
    const defaultTaxPercent = (settings.defaultTaxPercent as number) ?? 0;

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
          tenantId,
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      });
      const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

      const createdBill = await tx.bill.create({
        data: {
          tenantId,
          billNumber,
          templateId: finalTemplateId,
          partyId: party.id,
          ...snapshot,
          rows,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent ?? defaultTaxPercent,
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

      if (isQuickBill && body.paymentMode) {
        await tx.payment.create({
          data: {
            tenantId,
            partyId: party.id,
            direction: party.type === "CUSTOMER" ? "INCOMING" : "OUTGOING",
            amount: resolvedGrandTotal,
            date: now,
            mode: body.paymentMode,
            status: "COMPLETED",
            linkedBillId: createdBill.id,
            createdBy: userId!,
          },
        });

        const paymentDelta = getPaymentBalanceDelta(
          party.type as "CUSTOMER" | "VENDOR",
          party.type === "CUSTOMER" ? "INCOMING" : "OUTGOING",
          resolvedGrandTotal
        );
        await tx.party.update({
          where: { id: party.id },
          data: { currentBalance: { increment: paymentDelta } },
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
