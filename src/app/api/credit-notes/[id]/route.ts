import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const tenantResolution = await resolveReadTenant(request);
    if (!tenantResolution.ok) {
        return tenantResolution.response;
    }
    const tenantId = tenantResolution.tenantId;
    const { id } = await params;

    try {
        const entry = await prisma.journalEntry.findFirst({
            where: {
                id,
                tenantId,
                voucherType: { in: ["CREDIT_NOTE", "DEBIT_NOTE"] },
            },
            include: {
                lines: {
                    orderBy: { id: "asc" },
                },
            },
        });

        if (!entry) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        const creator = await prisma.user.findUnique({
            where: { id: entry.createdBy },
            select: { name: true },
        });

        const partyLine = entry.lines.find((l) => l.partyId);

        const narrationMatch = entry.narration?.match(
            /(?:Credit|Debit) Note against (.+?) \((.+?)\)/
        );

        const note = {
            id: entry.id,
            entryDate: entry.entryDate,
            narration: entry.narration,
            voucherType: entry.voucherType,
            grandTotal: Number(entry.totalDebit),
            createdAt: entry.createdAt,
            createdBy: creator?.name || "Unknown",
            originalInvoiceNo: narrationMatch?.[1] || null,
            reasonForIssuance: narrationMatch?.[2] || null,
            partyId: partyLine?.partyId || null,
            partyName: partyLine?.partyName || null,
            lines: entry.lines.map((l) => ({
                id: l.id,
                accountCode: l.accountCode,
                debit: Number(l.debit),
                credit: Number(l.credit),
                partyId: l.partyId,
                partyName: l.partyName,
            })),
        };

        return NextResponse.json({ note });
    } catch (error) {
        logError("notes.detail.error", {
            requestId: getRequestId(request),
            error,
        });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
