import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

// GET /api/bank-accounts - List all bank accounts
export async function GET(request: NextRequest) {
    const reqId = getRequestId(request);
    const searchParams = request.nextUrl.searchParams;

    try {
        const tenantResolution = await resolveReadTenant(request);
        if (!tenantResolution.ok) {
            return tenantResolution.response;
        }
        const tenantId = tenantResolution.tenantId;

        const typeFilter = searchParams.get("type"); // "BANK" | "CASH" | null

        const where: any = {
            tenantId,
            isDeleted: false,
            isActive: true,
        };

        if (typeFilter && ["BANK", "CASH"].includes(typeFilter)) {
            where.type = typeFilter;
        }

        const accounts = await prisma.bankAccount.findMany({
            where,
            orderBy: [
                { type: "desc" }, // CASH first, then BANK (since C before B, desc makes it CASH, BANK) Wait, 'CASH' 'BANK' alphabetical C comes after B. Desc gives CASH first.
                { name: "asc" }
            ],
        });

        return NextResponse.json({ accounts }, { status: 200 });
    } catch (error) {
        logError("Failed to fetch bank accounts", { reqId, error });
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

// POST /api/bank-accounts - Create a new bank account or cash ledger
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);

    try {
        const tenantResolution = await resolveWriteTenant(request);
        if (!tenantResolution.ok) {
            return tenantResolution.response;
        }
        const tenantId = tenantResolution.tenantId;
        const userId = request.headers.get("x-user-id");

        const body = await request.json().catch(() => ({}));

        // Basic Validation
        if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
            return NextResponse.json({ error: "Account Name is required" }, { status: 400 });
        }

        if (!body.type || !["BANK", "CASH"].includes(body.type)) {
            return NextResponse.json({ error: "Invalid Account Type" }, { status: 400 });
        }

        const name = body.name.trim();

        // Check Duplicate Name
        const existing = await prisma.bankAccount.findFirst({
            where: {
                tenantId,
                name: {
                    equals: name,
                    mode: "insensitive",
                },
                isDeleted: false,
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "An account with this name already exists" },
                { status: 409 }
            );
        }

        const openingBalance = typeof body.openingBalance === "number" ? body.openingBalance : 0;

        // Create the account
        // Note: Creating a BankAccount with an opening balance doesn't automatically create a journal entry, 
        // unless we also add an Opening Balance equity ledger. For simplicity, we just set the balance.
        const account = await prisma.bankAccount.create({
            data: {
                tenantId,
                name,
                type: body.type,
                accountNumber: typeof body.accountNumber === "string" ? body.accountNumber.trim() : null,
                openingBalance,
                currentBalance: openingBalance,
                createdBy: userId,
            },
        });

        return NextResponse.json({ account }, { status: 201 });
    } catch (error) {
        logError("Failed to create bank account", { reqId, error });
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
