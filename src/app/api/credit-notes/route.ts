import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant, resolveWriteSession } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";
import {
  createJournalEntry,
  buildSalesTaxLines,
  buildPurchaseTaxLines,
} from "@/lib/journal";
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
  // [FIX #1] Use JWT-verified tenant instead of trusting proxy headers for role
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

  // [FIX #1] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) {
    return sessionResolution.response;
  }
  const { tenantId, userId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const isSalesReturn = noteType === "CREDIT_NOTE";

      // Update party balance — both note types reduce outstanding
      await tx.party.update({
        where: { id: party.id },
        data: { currentBalance: { increment: grandTotal } },
      });

      // [FIX #4 & #5] Use createJournalEntry for validation + correct Section 170 tax rounding
      const entry = isSalesReturn
        ? await createJournalEntry(tx, {
            tenantId,
            entryDate: new Date(),
            narration: `Credit Note against ${originalInvoiceNo} (${reasonForIssuance})`,
            voucherType: "CREDIT_NOTE",
            createdBy: userId,
            lines: [
              {
                accountCode: "SUNDRY_DEBTORS",
                debit: 0,
                credit: grandTotal,
                partyId: party.id,
                partyName: party.name,
              },
              {
                accountCode: "SALES",
                debit: subtotal,
                credit: 0,
              },
              // Output tax reversed (debited) — uses same rounding as sales bills
              ...buildSalesTaxLines(taxAmount, "DEBIT", isInterState),
            ],
          })
        : await createJournalEntry(tx, {
            tenantId,
            entryDate: new Date(),
            narration: `Debit Note against ${originalInvoiceNo} (${reasonForIssuance})`,
            voucherType: "DEBIT_NOTE",
            createdBy: userId,
            lines: [
              {
                accountCode: "SUNDRY_CREDITORS",
                debit: grandTotal,
                credit: 0,
                partyId: party.id,
                partyName: party.name,
              },
              {
                accountCode: "PURCHASE",
                debit: 0,
                credit: subtotal,
              },
              // Input tax reversed (credited) — uses same rounding as purchase bills
              ...buildPurchaseTaxLines(taxAmount, "CREDIT", isInterState),
            ],
          });

      // [MCA GSR 247(E)] Audit trail
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: "JournalEntry",
          entityId: entry.id,
          userId,
          action: "CREATE",
        },
      });

      return entry;
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    logError("notes.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
