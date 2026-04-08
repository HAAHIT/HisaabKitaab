import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Fetches a finalized, non-deleted bill by id and returns it as JSON.
 *
 * @param _request - The incoming NextRequest (unused).
 * @param params - An object containing the route `id` to look up.
 * @returns `NextResponse` containing `{ bill }` when a matching bill is found; otherwise a 404 response with `{ error: "Bill not found" }`.
 */
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
