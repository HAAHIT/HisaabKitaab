import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bill = await prisma.bill.findFirst({
    where: {
      id,
      status: "FINAL",
      isDeleted: false,
    },
    select: {
      billNumber: true,
      customerName: true,
      grandTotal: true,
      rows: true,
      subtotal: true,
      taxPercent: true,
      taxAmount: true,
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
