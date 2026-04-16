import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import {
  getPostedBillBalanceDelta,
} from "@/lib/accounting";
import {
  journalForCancelledSalesBill,
} from "@/lib/journal";
import { NextRequest, NextResponse } from "next/server";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";
import crypto from "crypto";
import { z } from "zod";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function generateLockKey(tenantId: string): bigint {
  const hash = crypto.createHash("sha256").update(tenantId).digest("hex");
  return BigInt("0x" + hash.substring(0, 15));
}

const CreateNoteSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  originalInvoiceNo: z.string().min(1, "Original Invoice Reference is required"),
  reasonForIssuance: z.string().min(1, "Reason for Issuance is required"),
  placeOfSupply: z.string().refine((val) => GST_STATE_CODE_SET.has(val), {
      message: "Invalid place of supply. Must be a 2-digit GST state code.",
    }),
  noteType: z.enum(["CREDIT_NOTE", "DEBIT_NOTE"]),
  subtotal: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
  isInterState: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "notes.create", 30);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const rawBody = await request.json();
    let body: z.infer<typeof CreateNoteSchema>;
    try {
      body = CreateNoteSchema.parse(rawBody);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMsg = err.issues.map((i) => i.message).join(", ");
        return NextResponse.json({ error: errorMsg, details: err.issues }, { status: 400 });
      }
      throw err;
    }

    const {
      partyId,
      originalInvoiceNo,
      reasonForIssuance,
      noteType,
      subtotal,
      taxAmount,
      grandTotal,
      isInterState,
    } = body;

    const party = await prisma.party.findFirst({
      where: { id: partyId, tenantId, isDeleted: false, isActive: true },
      select: { id: true, name: true, type: true },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (grandTotal <= 0) {
      return NextResponse.json({ error: "Note must have a positive total" }, { status: 400 });
    }

    const note = await prisma.$transaction(async (tx: PrismaTx) => {
      const lockKey = generateLockKey(tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // We simply create a JournalEntry for the note, no Bill entity is stored for notes in this logic.
      // If noteType === CREDIT_NOTE, it's a sales return (reduce debtor balance).
      // If noteType === DEBIT_NOTE, it's a purchase return (reduce creditor balance).
      
      const isSalesReturn = noteType === "CREDIT_NOTE";
      
      if (isSalesReturn) {
         // Decrease customer balance
         const balanceChange = -grandTotal; // Assuming + is receivable for CUSTOMER, we decrease it
         await tx.party.update({
            where: { id: party.id },
            data: { currentBalance: { increment: balanceChange } },
         });

         const entry = await journalForCancelledSalesBill(tx, tenantId, {
            id: `CN-${Date.now()}`,
            billNumber: originalInvoiceNo,
            partyId: party.id,
            partyName: party.name,
            subtotal,
            taxAmount,
            grandTotal,
            createdBy: userId!,
            entryDate: new Date(),
            isInterState: isInterState || false,
         });

         // add narration logic
         await tx.journalEntry.update({
            where: { id: entry.id },
            data: { narration: `Credit Note against ${originalInvoiceNo} (${reasonForIssuance})` },
         });
         return entry;
      } else {
         // DEBIT_NOTE (Purchase Return)
         // Vendor balance is negative for payables. Purchase return reduces payable, so it increases balance.
         const balanceChange = grandTotal; 
         await tx.party.update({
            where: { id: party.id },
            data: { currentBalance: { increment: balanceChange } },
         });

         // Minimal implementation for debit note journal entry
         const totalDebit = grandTotal;
         const entry = await tx.journalEntry.create({
            data: {
               tenantId,
               entryDate: new Date(),
               narration: `Debit Note against ${originalInvoiceNo} (${reasonForIssuance})`,
               voucherType: "DEBIT_NOTE",
               createdBy: userId!,
               totalDebit,
               totalCredit: totalDebit,
               isBalanced: true,
               lines: {
                  create: [
                     {
                        accountCode: "SUNDRY_CREDITORS",
                        accountName: "Sundry Creditors",
                        tallyGroup: "Sundry Creditors",
                        partyId: party.id,
                        partyName: party.name,
                        debit: grandTotal,
                        credit: 0,
                     },
                     {
                        accountCode: "PURCHASE",
                        accountName: "Purchase",
                        tallyGroup: "Purchase Accounts",
                        debit: 0,
                        credit: subtotal,
                     },
                     // Simplifying taxes for debit note to IGST_INPUT / etc. for now if tax > 0
                     ...(taxAmount > 0 ? [{
                        accountCode: (isInterState ? "IGST_INPUT" : "CGST_INPUT") as string,
                        accountName: "Tax Input",
                        tallyGroup: "Duties & Taxes",
                        debit: 0,
                        credit: taxAmount,
                     }] : [])
                  ]
               }
            }
         });
         return entry;
      }
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    logError("notes.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
