import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await checkRateLimit(request, "bills.public", 60);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const tenantId = request.nextUrl.searchParams.get("tenantId")?.trim() || null;

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId query parameter is required" },
      { status: 400 }
    );
  }

  const bill = await prisma.bill.findFirst({
    where: {
      id,
      tenantId,
      status: "FINAL",
      isDeleted: false,
    },
    select: {
      billNumber: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      gstin: true,
      grandTotal: true,
      rows: true,
      subtotal: true,
      taxPercent: true,
      taxAmount: true,
      roundOff: true,
      isInterState: true,
      shippingAddress: true,
      placeOfSupply: true,
      hsnCode: true,
      notes: true,
      terms: true,
      createdAt: true,
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json({ bill });
}
