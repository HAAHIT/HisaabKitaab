import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { serializeTenantSettings } from "@/lib/tenant-settings";

// GET /api/bills/:id/public
// Public endpoint — returns a FINAL bill with company info for rendering.
// No auth required. Bill IDs are cuid (unguessable).
// Rate-limited at 60 req/min per IP.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await checkRateLimit(request, "bills.public", 60);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;

  const bill = await prisma.bill.findFirst({
    where: { id, status: "FINAL", isDeleted: false },
    select: {
      id: true,
      billNumber: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      gstin: true,
      rows: true,
      notes: true,
      terms: true,
      subtotal: true,
      taxPercent: true,
      taxAmount: true,
      grandTotal: true,
      roundOff: true,
      isInterState: true,
      placeOfSupply: true,
      hsnCode: true,
      createdAt: true,
      template: { select: { name: true, columns: true } },
      tenant: {
        select: {
          name: true,
          phone: true,
          email: true,
          address: true,
          gstin: true,
          logoUrl: true,
          settings: true,
        },
      },
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const company = serializeTenantSettings(bill.tenant);

  return NextResponse.json({
    bill: {
      ...bill,
      subtotal: Number(bill.subtotal),
      taxAmount: Number(bill.taxAmount),
      grandTotal: Number(bill.grandTotal),
      taxPercent: Number(bill.taxPercent),
      roundOff: Number(bill.roundOff),
    },
    company,
  });
}
