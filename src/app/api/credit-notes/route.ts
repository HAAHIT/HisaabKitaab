import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
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
  hsnCode: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.taxAmount > 0 && !data.hsnCode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HSN code is required since the note contains GST elements.",
      path: ["hsnCode"],
    });
  }
});

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = 20;

    const voucherTypeFilter =
      type === "CREDIT_NOTE"
        ? ["CREDIT_NOTE"]
        : type === "DEBIT_NOTE"
        ? ["DEBIT_NOTE"]
        : ["CREDIT_NOTE", "DEBIT_NOTE"];

    const where = {
      tenantId,
      voucherType: { in: voucherTypeFilter as ("CREDIT_NOTE" | "DEBIT_NOTE")[] },
      ...(search
        ? { narration: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          entryDate: true,
          narration: true,
          voucherType: true,
          totalDebit: true,
          lines: {
            where: { partyName: { not: null } },
            take: 1,
            select: { partyName: true, partyId: true },
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    const notes = entries.map((e) => ({
      id: e.id,
      entryDate: e.entryDate,
      narration: e.narration,
      voucherType: e.voucherType,
      grandTotal: Number(e.totalDebit),
      partyName: e.lines[0]?.partyName ?? null,
      partyId: e.lines[0]?.partyId ?? null,
    }));

    return NextResponse.json({
      notes,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    logError("notes.list.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
      // [LB-1] Prevent indefinite blocking from hung transactions
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // We simply create a JournalEntry for the note, no Bill entity is stored for notes in this logic.
      // If noteType === CREDIT_NOTE, it's a sales return (reduce debtor balance).
      // If noteType === DEBIT_NOTE, it's a purchase return (reduce creditor balance).
      
      const isSalesReturn = noteType === "CREDIT_NOTE";
      
      if (isSalesReturn) {
         // Sales return: customer owes us less → balance increases (becomes less negative)
         await tx.party.update({
            where: { id: party.id },
            data: { currentBalance: { increment: grandTotal } },
         });

         // Build tax lines (output tax is reversed — debited)
         const taxLines = taxAmount > 0
           ? (isInterState
               ? [{ accountCode: "IGST_OUTPUT", accountName: "IGST Output", tallyGroup: "Duties & Taxes", debit: taxAmount, credit: 0 }]
               : (() => {
                   const half = Math.round((taxAmount / 2) * 100) / 100;
                   const other = Math.round((taxAmount - half) * 100) / 100;
                   return [
                     { accountCode: "CGST_OUTPUT", accountName: "CGST Output", tallyGroup: "Duties & Taxes", debit: half, credit: 0 },
                     { accountCode: "SGST_OUTPUT", accountName: "SGST Output", tallyGroup: "Duties & Taxes", debit: other, credit: 0 },
                   ];
                 })())
           : [];

         const entry = await tx.journalEntry.create({
            data: {
               tenantId,
               entryDate: new Date(),
               narration: `Credit Note against ${originalInvoiceNo} (${reasonForIssuance})`,
               voucherType: "CREDIT_NOTE",
               createdBy: userId!,
               totalDebit: grandTotal,
               totalCredit: grandTotal,
               isBalanced: true,
               lines: {
                  create: [
                     {
                        accountCode: "SUNDRY_DEBTORS",
                        accountName: "Sundry Debtors",
                        tallyGroup: "Sundry Debtors",
                        partyId: party.id,
                        partyName: party.name,
                        debit: 0,
                        credit: grandTotal,
                     },
                     {
                        accountCode: "SALES",
                        accountName: "Sales",
                        tallyGroup: "Sales Accounts",
                        debit: subtotal,
                        credit: 0,
                     },
                     ...taxLines,
                  ],
               },
            },
         });

         // [LB-2] MCA GSR 247(E) — audit trail for Credit Note creation
         await tx.auditLog.create({
           data: {
             tenantId,
             entityType: "JournalEntry",
             entityId: entry.id,
             userId: userId!,
             action: "CREATE",
           },
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
                     // [LB-3] Proper CGST+SGST split for intra-state debit notes
                     ...(taxAmount > 0
                       ? (isInterState
                           ? [{ accountCode: "IGST_INPUT", accountName: "IGST Input", tallyGroup: "Duties & Taxes", debit: 0, credit: taxAmount }]
                           : (() => {
                               const half = Math.round((taxAmount / 2) * 100) / 100;
                               const other = Math.round((taxAmount - half) * 100) / 100;
                               return [
                                 { accountCode: "CGST_INPUT", accountName: "CGST Input", tallyGroup: "Duties & Taxes", debit: 0, credit: half },
                                 { accountCode: "SGST_INPUT", accountName: "SGST Input", tallyGroup: "Duties & Taxes", debit: 0, credit: other },
                               ];
                             })())
                       : [])
                  ]
               }
            }
         });

         // [LB-2] MCA GSR 247(E) — audit trail for Debit Note creation
         await tx.auditLog.create({
           data: {
             tenantId,
             entityType: "JournalEntry",
             entityId: entry.id,
             userId: userId!,
             action: "CREATE",
           },
         });

         return entry;
      }
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    logError("notes.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
