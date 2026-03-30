# Epic 8: Double-Entry Journal & CA Export System

> **Audience**: Starter-level developer. Every instruction is exact.  
> **Priority**: HIGH — This is the CA trust moat.  
> **Depends on**: Epic 0 (tenantId), Epic 3 (billing), Epic 7 (purchases)  
> **Philosophy**: The shopkeeper NEVER sees this. The CA sees perfect, balanced books.

---

## The Architecture (Two Layers)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONT-END (What the shopkeeper sees)                       │
│                                                             │
│   "Money In"  →  Creates bill / receives payment            │
│   "Money Out" →  Records payment / scans purchase bill      │
│                                                             │
│   No jargon. No accounting terms. Just money flow.          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (invisible to shopkeeper)
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: JOURNAL ENGINE (Automatic)                        │
│                                                             │
│   Every front-end action auto-creates journal entries:      │
│                                                             │
│   Sales Bill → Dr. Sundry Debtors / Cr. Sales + Tax        │
│   Payment In → Dr. Cash/Bank / Cr. Sundry Debtors          │
│   Purchase   → Dr. Purchase + Tax / Cr. Sundry Creditors   │
│   Payment Out→ Dr. Sundry Creditors / Cr. Cash/Bank        │
│                                                             │
│   RULE: sum(debit) MUST == sum(credit) or entry REJECTED   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (CA downloads this)
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: CA EXPORT                                         │
│                                                             │
│   Excel/CSV mapped to Tally's Chart of Accounts            │
│   ✓ Transaction Register (date-wise)                       │
│   ✓ Party Ledger (per-party reconciliation)                │
│   ✓ Trial Balance (period summary)                         │
│   ✓ Tally XML (optional, secondary format)                 │
│                                                             │
│   GATE: Export BLOCKED if any unbalanced entries exist      │
└─────────────────────────────────────────────────────────────┘
```

---

## Task 8.1 — Chart of Accounts (Hardcoded Mapping)

The Chart of Accounts (CoA) maps every transaction to standard accounting ledger groups that Tally/CAs understand. For an MSME, this is a small, fixed set.

### File: `src/lib/chart-of-accounts.ts` (NEW)

```typescript
/**
 * Standard Chart of Accounts for Indian MSME.
 * Maps to Tally Prime's 28 predefined ledger groups.
 * 
 * DO NOT let users create custom accounts.
 * DO NOT expose these names to the shopkeeper UI.
 * These are ONLY used in journal entries and CA exports.
 */

export type AccountCode =
  | "SALES"
  | "PURCHASE"
  | "SUNDRY_DEBTORS"
  | "SUNDRY_CREDITORS"
  | "CASH"
  | "BANK"
  | "UPI"
  | "CGST_OUTPUT"
  | "SGST_OUTPUT"
  | "IGST_OUTPUT"
  | "CGST_INPUT"
  | "SGST_INPUT"
  | "IGST_INPUT"
  | "OWNER_EQUITY"
  | "OPENING_BALANCE";

export interface AccountDefinition {
  code: AccountCode;
  name: string;             // Tally-compatible ledger name
  tallyGroup: string;       // Must match one of Tally's 28 groups EXACTLY
  type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
  normalBalance: "DEBIT" | "CREDIT";
}

export const CHART_OF_ACCOUNTS: Record<AccountCode, AccountDefinition> = {
  // ── Revenue ─────────────────────
  SALES: {
    code: "SALES",
    name: "Sales Account",
    tallyGroup: "Sales Accounts",
    type: "INCOME",
    normalBalance: "CREDIT",
  },

  // ── Expenses ────────────────────
  PURCHASE: {
    code: "PURCHASE",
    name: "Purchase Account",
    tallyGroup: "Purchase Accounts",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },

  // ── Receivables ─────────────────
  SUNDRY_DEBTORS: {
    code: "SUNDRY_DEBTORS",
    name: "Sundry Debtors",
    tallyGroup: "Sundry Debtors",
    type: "ASSET",
    normalBalance: "DEBIT",
  },

  // ── Payables ────────────────────
  SUNDRY_CREDITORS: {
    code: "SUNDRY_CREDITORS",
    name: "Sundry Creditors",
    tallyGroup: "Sundry Creditors",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },

  // ── Cash & Bank ─────────────────
  CASH: {
    code: "CASH",
    name: "Cash",
    tallyGroup: "Cash-in-Hand",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  BANK: {
    code: "BANK",
    name: "Bank Account",
    tallyGroup: "Bank Accounts",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  UPI: {
    code: "UPI",
    name: "UPI Account",
    tallyGroup: "Bank Accounts",  // UPI maps to Bank in Tally
    type: "ASSET",
    normalBalance: "DEBIT",
  },

  // ── Tax Accounts (Output = Collected) ──
  CGST_OUTPUT: {
    code: "CGST_OUTPUT",
    name: "CGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  SGST_OUTPUT: {
    code: "SGST_OUTPUT",
    name: "SGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  IGST_OUTPUT: {
    code: "IGST_OUTPUT",
    name: "IGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },

  // ── Tax Accounts (Input = Paid) ─────
  CGST_INPUT: {
    code: "CGST_INPUT",
    name: "CGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  SGST_INPUT: {
    code: "SGST_INPUT",
    name: "SGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  IGST_INPUT: {
    code: "IGST_INPUT",
    name: "IGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },

  // ── Capital ─────────────────────
  OWNER_EQUITY: {
    code: "OWNER_EQUITY",
    name: "Capital Account",
    tallyGroup: "Capital Account",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
  OPENING_BALANCE: {
    code: "OPENING_BALANCE",
    name: "Opening Balance Equity",
    tallyGroup: "Capital Account",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
};

/**
 * Maps payment modes to account codes.
 */
export function paymentModeToAccount(mode: string): AccountCode {
  switch (mode) {
    case "CASH": return "CASH";
    case "UPI": return "UPI";
    case "BANK_TRANSFER": return "BANK";
    case "CHEQUE": return "BANK";
    default: return "CASH";
  }
}
```

### ⛔ DO NOT:
- Let users create custom accounts — the CoA is fixed for compliance
- Show account names in the shopkeeper UI — this is backend-only
- Use different group names than Tally's exact 28 — imports will fail
- Add "Indirect Income/Expense" accounts yet — not needed for MSME Phase 1

---

## Task 8.2 — Journal Entry Data Model

### File: `prisma/schema.prisma` — Add JournalEntry model

```prisma
model JournalEntry {
  id          String        @id @default(cuid())
  tenantId    String
  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  
  // What financial event created this entry
  entryDate   DateTime      // Business date of the transaction
  narration   String        // Human-readable description  
  voucherType VoucherType   // SALES, PURCHASE, RECEIPT, PAYMENT, JOURNAL
  
  // Source reference (exactly ONE of these will be set)
  billId      String?       // Links to Bill (sales)
  purchaseId  String?       // Links to PurchaseBill
  paymentId   String?       // Links to Payment
  
  // The debit/credit legs
  lines       JournalLine[]
  
  // Validation
  isBalanced  Boolean       @default(false)  // System-computed: sum(Dr) == sum(Cr)
  totalDebit  Float         @default(0)      // Cached for fast validation
  totalCredit Float         @default(0)      // Cached for fast validation
  
  // Audit
  createdBy   String
  createdAt   DateTime      @default(now())
  
  @@index([tenantId])
  @@index([tenantId, entryDate])
  @@index([tenantId, voucherType])
  @@index([billId])
  @@index([purchaseId])
  @@index([paymentId])
}

model JournalLine {
  id           String       @id @default(cuid())
  journalId    String
  journal      JournalEntry @relation(fields: [journalId], references: [id], onDelete: Cascade)
  
  accountCode  String       // From AccountCode enum (SALES, CASH, etc.)
  accountName  String       // Resolved name for display ("Sales Account")
  tallyGroup   String       // Tally group for export ("Sales Accounts")
  
  // Party sub-ledger (for Sundry Debtors/Creditors)
  partyId      String?
  partyName    String?      // Snapshot for export
  
  debit        Float        @default(0)
  credit       Float        @default(0)
  
  @@index([journalId])
  @@index([accountCode])
}

enum VoucherType {
  SALES       // Sales bill finalized
  PURCHASE    // Purchase bill recorded
  RECEIPT     // Payment received (money IN)
  PAYMENT     // Payment made (money OUT)
  JOURNAL     // Manual adjustment (future)
}
```

Add `journalEntries JournalEntry[]` to the `Tenant` model.

### ⛔ DO NOT:
- Allow UPDATE on JournalEntry — journal is append-only. To correct, create a reversal entry.
- Store amounts as integers (paisa) — use Float for consistency with existing models. Precision is handled at validation.
- Add `isDeleted` to JournalEntry — journal entries are permanent by design.

---

## Task 8.3 — Journal Recording Functions

### File: `src/lib/journal.ts` (NEW)

The core engine that creates balanced journal entries from business events.

```typescript
import { PrismaClient } from "@prisma/client";
import { 
  CHART_OF_ACCOUNTS, 
  paymentModeToAccount,
  type AccountCode
} from "./chart-of-accounts";

type PrismaTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface JournalLineInput {
  accountCode: AccountCode;
  debit: number;
  credit: number;
  partyId?: string | null;
  partyName?: string | null;
}

/**
 * CRITICAL FUNCTION: Creates a balanced journal entry.
 * Throws an error if debits ≠ credits.
 * 
 * Call this INSIDE an existing Prisma transaction.
 */
export async function createJournalEntry(
  tx: PrismaTx,
  params: {
    tenantId: string;
    entryDate: Date;
    narration: string;
    voucherType: "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL";
    billId?: string;
    purchaseId?: string;
    paymentId?: string;
    createdBy: string;
    lines: JournalLineInput[];
  }
) {
  const { lines, ...entryData } = params;

  // ═══ BALANCE VALIDATION (THE MOST IMPORTANT CHECK IN THE SYSTEM) ═══
  const totalDebit = roundTo2(lines.reduce((sum, l) => sum + l.debit, 0));
  const totalCredit = roundTo2(lines.reduce((sum, l) => sum + l.credit, 0));

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `UNBALANCED JOURNAL ENTRY: Debit (${totalDebit}) ≠ Credit (${totalCredit}). ` +
      `Narration: "${params.narration}". This is a bug — contact the developer.`
    );
  }

  // Validate each line has either debit or credit (not both, not neither)
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `Journal line cannot have both debit AND credit. ` +
        `Account: ${line.accountCode}, Dr: ${line.debit}, Cr: ${line.credit}`
      );
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new Error(
        `Journal line must have either debit or credit. Account: ${line.accountCode}`
      );
    }
  }

  // Create the entry with all lines
  return tx.journalEntry.create({
    data: {
      ...entryData,
      totalDebit,
      totalCredit,
      isBalanced: true,
      lines: {
        createMany: {
          data: lines.map((line) => {
            const account = CHART_OF_ACCOUNTS[line.accountCode];
            return {
              accountCode: line.accountCode,
              accountName: account.name,
              tallyGroup: account.tallyGroup,
              partyId: line.partyId || null,
              partyName: line.partyName || null,
              debit: roundTo2(line.debit),
              credit: roundTo2(line.credit),
            };
          }),
        },
      },
    },
    include: { lines: true },
  });
}

// ════════════════════════════════════════════════════════════
// Pre-built journal creators for each business event
// ════════════════════════════════════════════════════════════

/**
 * Sales Bill Finalized:
 *   Dr. Sundry Debtors (Party)     → grandTotal
 *   Cr. Sales Account               → subtotal
 *   Cr. CGST/SGST Output            → taxAmount (split 50/50 for intra-state)
 */
export async function journalForSalesBill(
  tx: PrismaTx,
  tenantId: string,
  bill: {
    id: string;
    billNumber: string;
    partyId: string;
    partyName: string;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    createdBy: string;
    createdAt: Date;
  }
) {
  const lines: JournalLineInput[] = [
    // Debit: Customer owes us
    {
      accountCode: "SUNDRY_DEBTORS",
      debit: bill.grandTotal,
      credit: 0,
      partyId: bill.partyId,
      partyName: bill.partyName,
    },
    // Credit: Sales revenue
    {
      accountCode: "SALES",
      debit: 0,
      credit: bill.subtotal,
    },
  ];

  // Tax split (assume intra-state: 50% CGST + 50% SGST)
  if (bill.taxAmount > 0) {
    const halfTax = roundTo2(bill.taxAmount / 2);
    const otherHalf = roundTo2(bill.taxAmount - halfTax); // Handles odd paisa

    lines.push(
      { accountCode: "CGST_OUTPUT", debit: 0, credit: halfTax },
      { accountCode: "SGST_OUTPUT", debit: 0, credit: otherHalf }
    );
  }

  return createJournalEntry(tx, {
    tenantId,
    entryDate: bill.createdAt,
    narration: `Sales Bill ${bill.billNumber} to ${bill.partyName}`,
    voucherType: "SALES",
    billId: bill.id,
    createdBy: bill.createdBy,
    lines,
  });
}

/**
 * Payment Received (from Customer):
 *   Dr. Cash/Bank/UPI              → amount
 *   Cr. Sundry Debtors (Party)     → amount
 */
export async function journalForPaymentReceived(
  tx: PrismaTx,
  tenantId: string,
  payment: {
    id: string;
    partyId: string;
    partyName: string;
    amount: number;
    mode: string;
    date: Date;
    createdBy: string;
  }
) {
  return createJournalEntry(tx, {
    tenantId,
    entryDate: payment.date,
    narration: `Payment received from ${payment.partyName} (${payment.mode})`,
    voucherType: "RECEIPT",
    paymentId: payment.id,
    createdBy: payment.createdBy,
    lines: [
      {
        accountCode: paymentModeToAccount(payment.mode),
        debit: payment.amount,
        credit: 0,
      },
      {
        accountCode: "SUNDRY_DEBTORS",
        debit: 0,
        credit: payment.amount,
        partyId: payment.partyId,
        partyName: payment.partyName,
      },
    ],
  });
}

/**
 * Purchase Bill Recorded:
 *   Dr. Purchase Account           → subtotal
 *   Dr. CGST/SGST Input            → tax
 *   Cr. Sundry Creditors (Vendor)  → grandTotal
 */
export async function journalForPurchaseBill(
  tx: PrismaTx,
  tenantId: string,
  purchase: {
    id: string;
    vendorName: string;
    partyId: string | null;
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    grandTotal: number;
    createdBy: string;
    billDate: Date;
  }
) {
  const lines: JournalLineInput[] = [
    {
      accountCode: "PURCHASE",
      debit: purchase.subtotal,
      credit: 0,
    },
    {
      accountCode: "SUNDRY_CREDITORS",
      debit: 0,
      credit: purchase.grandTotal,
      partyId: purchase.partyId,
      partyName: purchase.vendorName,
    },
  ];

  if (purchase.cgst > 0) {
    lines.push({ accountCode: "CGST_INPUT", debit: purchase.cgst, credit: 0 });
  }
  if (purchase.sgst > 0) {
    lines.push({ accountCode: "SGST_INPUT", debit: purchase.sgst, credit: 0 });
  }
  if (purchase.igst > 0) {
    lines.push({ accountCode: "IGST_INPUT", debit: purchase.igst, credit: 0 });
  }

  return createJournalEntry(tx, {
    tenantId,
    entryDate: purchase.billDate,
    narration: `Purchase from ${purchase.vendorName}`,
    voucherType: "PURCHASE",
    purchaseId: purchase.id,
    createdBy: purchase.createdBy,
    lines,
  });
}

/**
 * Payment Made (to Vendor):
 *   Dr. Sundry Creditors (Vendor)  → amount
 *   Cr. Cash/Bank/UPI              → amount
 */
export async function journalForPaymentMade(
  tx: PrismaTx,
  tenantId: string,
  payment: {
    id: string;
    partyId: string;
    partyName: string;
    amount: number;
    mode: string;
    date: Date;
    createdBy: string;
  }
) {
  return createJournalEntry(tx, {
    tenantId,
    entryDate: payment.date,
    narration: `Payment to ${payment.partyName} (${payment.mode})`,
    voucherType: "PAYMENT",
    paymentId: payment.id,
    createdBy: payment.createdBy,
    lines: [
      {
        accountCode: "SUNDRY_CREDITORS",
        debit: payment.amount,
        credit: 0,
        partyId: payment.partyId,
        partyName: payment.partyName,
      },
      {
        accountCode: paymentModeToAccount(payment.mode),
        debit: 0,
        credit: payment.amount,
      },
    ],
  });
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

### ⛔ DO NOT:
- Call `createJournalEntry` outside a Prisma `$transaction` — it must be atomic with the business event
- Skip the balance validation — this is the SINGLE MOST IMPORTANT check in the entire system
- Allow `debit > 0 && credit > 0` on the same line — each line is either debit OR credit
- Use `createMany` for the entry itself — only for lines within a single entry
- Round to more/fewer than 2 decimal places — Indian accounting standard is 2 decimals

---

## Task 8.4 — Wire Journal Into Existing Business Flows

Every financial action must now also create a journal entry. This requires modifying 3 API routes.

### File: `src/app/api/bills/route.ts` — POST handler

Add after the bill is created and party balance is updated (inside the `$transaction`):

```typescript
import { journalForSalesBill } from "@/lib/journal";

// ... inside the transaction, after line ~214:
if (billStatus === "FINAL") {
  await journalForSalesBill(tx, tenantId, {
    id: createdBill.id,
    billNumber,
    partyId: party.id,
    partyName: party.name,
    subtotal: subtotal || 0,
    taxAmount: taxAmount || 0,
    grandTotal: resolvedGrandTotal,
    createdBy: userId!,
    createdAt: now,
  });
}
```

### File: `src/app/api/payments/route.ts` — POST handler

Add after the payment is created (inside creation logic):

```typescript
import { journalForPaymentReceived, journalForPaymentMade } from "@/lib/journal";

// ... after payment creation:
const partyRecord = await tx.party.findUnique({ where: { id: partyId } });

if (direction === "INCOMING") {
  await journalForPaymentReceived(tx, tenantId, {
    id: createdPayment.id,
    partyId,
    partyName: partyRecord!.name,
    amount: parsedAmount,
    mode,
    date: new Date(date),
    createdBy: userId!,
  });
} else {
  await journalForPaymentMade(tx, tenantId, {
    id: createdPayment.id,
    partyId,
    partyName: partyRecord!.name,
    amount: parsedAmount,
    mode,
    date: new Date(date),
    createdBy: userId!,
  });
}
```

### File: `src/app/api/purchases/route.ts` — POST handler

Add after the purchase bill is created (inside `$transaction`):

```typescript
import { journalForPurchaseBill, journalForPaymentMade } from "@/lib/journal";

// After purchase creation:
await journalForPurchaseBill(tx, tenantId, {
  id: created.id,
  vendorName: vendorName.trim(),
  partyId: partyId || null,
  subtotal: subtotal || 0,
  cgst: cgst || 0,
  sgst: sgst || 0,
  igst: igst || 0,
  grandTotal,
  createdBy: userId!,
  billDate: billDate ? new Date(billDate) : new Date(),
});

// If paid immediately, also journal the payment
if (paymentMode && partyId) {
  await journalForPaymentMade(tx, tenantId, {
    id: created.id + "-payment",  // Unique ref
    partyId,
    partyName: vendorName.trim(),
    amount: grandTotal,
    mode: paymentMode,
    date: billDate ? new Date(billDate) : new Date(),
    createdBy: userId!,
  });
}
```

---

## Task 8.5 — CA Export API Routes

### File: `src/app/api/export/transactions/route.ts` (NEW)

Generates a CSV of all journal entries for a date range.

```typescript
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

// GET /api/export/transactions?from=2026-04-01&to=2026-03-31&format=csv
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") || "csv";

  if (!from || !to) {
    return NextResponse.json(
      { error: "Date range (from, to) is required" },
      { status: 400 }
    );
  }

  // ═══ BALANCE CHECK GATE ═══
  const unbalanced = await prisma.journalEntry.count({
    where: { tenantId, isBalanced: false },
  });

  if (unbalanced > 0) {
    return NextResponse.json({
      error: `Export blocked: ${unbalanced} unbalanced journal entries found. Contact support.`,
      unbalancedCount: unbalanced,
    }, { status: 409 });
  }

  // Fetch entries with lines
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      entryDate: {
        gte: new Date(from),
        lte: new Date(to),
      },
    },
    include: {
      lines: true,
    },
    orderBy: { entryDate: "asc" },
  });

  if (format === "json") {
    return NextResponse.json({ entries, totalEntries: entries.length });
  }

  // Generate CSV
  const csvRows: string[] = [];

  // Header row — matches Tally import format
  csvRows.push([
    "Date",
    "Voucher Type",
    "Voucher No.",
    "Narration",
    "Ledger Name",
    "Tally Group",
    "Party Name",
    "Debit",
    "Credit",
  ].map(escapeCSV).join(","));

  for (const entry of entries) {
    for (const line of entry.lines) {
      csvRows.push([
        formatDateForCSV(entry.entryDate),
        entry.voucherType,
        entry.billId || entry.purchaseId || entry.paymentId || entry.id,
        entry.narration,
        line.accountName,
        line.tallyGroup,
        line.partyName || "",
        line.debit > 0 ? line.debit.toFixed(2) : "",
        line.credit > 0 ? line.credit.toFixed(2) : "",
      ].map(escapeCSV).join(","));
    }
  }

  const csv = csvRows.join("\n");
  const filename = `transactions_${from}_to_${to}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function formatDateForCSV(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### File: `src/app/api/export/trial-balance/route.ts` (NEW)

```typescript
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import { NextRequest, NextResponse } from "next/server";

// GET /api/export/trial-balance?from=2026-04-01&to=2026-03-31
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Date range required" },
      { status: 400 }
    );
  }

  // Aggregate debits and credits per account
  const aggregates = await prisma.journalLine.groupBy({
    by: ["accountCode", "accountName", "tallyGroup"],
    where: {
      journal: {
        tenantId,
        entryDate: { gte: new Date(from), lte: new Date(to) },
        isBalanced: true,
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  // Build trial balance rows
  const rows = aggregates.map((agg) => {
    const totalDebit = agg._sum.debit || 0;
    const totalCredit = agg._sum.credit || 0;
    const netBalance = totalDebit - totalCredit;
    const account = CHART_OF_ACCOUNTS[agg.accountCode as keyof typeof CHART_OF_ACCOUNTS];

    return {
      accountCode: agg.accountCode,
      accountName: agg.accountName,
      tallyGroup: agg.tallyGroup,
      type: account?.type || "UNKNOWN",
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      closingDebit: netBalance > 0 ? Math.round(netBalance * 100) / 100 : 0,
      closingCredit: netBalance < 0 ? Math.round(Math.abs(netBalance) * 100) / 100 : 0,
    };
  });

  // Verify total debits = total credits
  const sumDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
  const sumCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
  const isBalanced = Math.abs(sumDebit - sumCredit) < 0.01;

  // CSV format
  const csvRows = [
    ["Account Name", "Tally Group", "Type", "Total Debit", "Total Credit", "Closing Debit", "Closing Credit"]
      .join(","),
    ...rows.map((r) =>
      [r.accountName, r.tallyGroup, r.type, r.totalDebit.toFixed(2), r.totalCredit.toFixed(2), r.closingDebit.toFixed(2), r.closingCredit.toFixed(2)]
        .map((v) => `"${v}"`)
        .join(",")
    ),
    "",
    `"TOTAL","","","${sumDebit.toFixed(2)}","${sumCredit.toFixed(2)}","",""`,
    `"BALANCED","","","${isBalanced ? "YES ✓" : "NO ✗"}","","",""`,
  ];

  const csv = csvRows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trial_balance_${from}_${to}.csv"`,
    },
  });
}
```

---

## Task 8.6 — Reports Page UI

### File: `src/app/(app)/reports/page.tsx` (NEW)

Admin/Accountant-only page with export controls.

```
┌──────────────────────────────────────────────────┐
│ 📊 Reports & Exports                             │
│ "Download clean books for your CA"                │
│                                                   │
│ ── Date Range ────────────────────────────────    │
│ Financial Year: [2025-26 ▼]                      │
│ Or custom: [From: 01/04/2025] [To: 31/03/2026]  │
│                                                   │
│ ── Available Reports ─────────────────────────    │
│                                                   │
│ ┌────────────────────────────────────────────┐    │
│ │ 📋 Transaction Register                    │    │
│ │ All journal entries with full details       │    │
│ │ [Download CSV] [Download Excel]            │    │
│ └────────────────────────────────────────────┘    │
│                                                   │
│ ┌────────────────────────────────────────────┐    │
│ │ ⚖️ Trial Balance                           │    │
│ │ Account-wise debit/credit summary          │    │
│ │ [Download CSV]                             │    │
│ └────────────────────────────────────────────┘    │
│                                                   │
│ ┌────────────────────────────────────────────┐    │
│ │ 👥 Party Ledger                            │    │
│ │ Per-party transaction detail               │    │
│ │ [Select Party ▼] [Download CSV]            │    │
│ └────────────────────────────────────────────┘    │
│                                                   │
│ ── System Check ──────────────────────────────    │
│ ✅ All 142 journal entries are balanced           │
│ ─ OR ─                                            │
│ ⚠️ 2 unbalanced entries found — export blocked   │
│    [View Details]                                 │
└──────────────────────────────────────────────────┘
```

**Financial year quick-select**: Indian FY runs April 1 to March 31. Offer presets:
- FY 2025-26 (Apr 2025 – Mar 2026)  
- Current Quarter
- Custom range

### ⛔ DO NOT:
- Show this page to STAFF or CUSTOMER roles — restrict to ADMIN and ACCOUNTANT
- Allow export if ANY entries are unbalanced — the gate must be absolute
- Generate the CSV on the client — all generation happens server-side via API
- Include DRAFT bills in exports — only FINAL bills have journal entries

---

## Task 8.7 — Navigation & Translations

**Add "Reports" to the navigation:**

Desktop sidebar: Show for ADMIN + ACCOUNTANT roles only.  
Mobile "More" sheet: Show between Purchases and Settings.

```typescript
{
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  translationKey: "nav.reports",
  href: "/reports",
  roles: ["ADMIN", "ACCOUNTANT"],
},
```

### Translation keys:

```typescript
// English
"nav.reports": "Reports",
"reports.title": "Reports & Exports",
"reports.subtitle": "Download clean books for your CA",
"reports.dateRange": "Date Range",
"reports.financialYear": "Financial Year",
"reports.customRange": "Custom Range",
"reports.transactionRegister": "Transaction Register",
"reports.transactionDesc": "All journal entries with full details",
"reports.trialBalance": "Trial Balance",
"reports.trialBalanceDesc": "Account-wise debit/credit summary",
"reports.partyLedger": "Party Ledger",
"reports.partyLedgerDesc": "Per-party transaction detail",
"reports.downloadCSV": "Download CSV",
"reports.downloadExcel": "Download Excel",
"reports.systemCheck": "System Check",
"reports.allBalanced": "All entries are balanced ✓",
"reports.unbalanced": "unbalanced entries found — export blocked",
"reports.selectParty": "Select Party",
"reports.exportBlocked": "Export is blocked until all entries are balanced",

// Hindi
"nav.reports": "रिपोर्ट",
"reports.title": "रिपोर्ट और एक्सपोर्ट",
"reports.subtitle": "अपने CA के लिए साफ हिसाब डाउनलोड करें",
"reports.dateRange": "तारीख रेंज",
"reports.financialYear": "वित्तीय वर्ष",
"reports.customRange": "कस्टम रेंज",
"reports.transactionRegister": "लेनदेन रजिस्टर",
"reports.transactionDesc": "सभी जर्नल एंट्री पूरे विवरण के साथ",
"reports.trialBalance": "ट्रायल बैलेंस",
"reports.trialBalanceDesc": "खाता-वार डेबिट/क्रेडिट सारांश",
"reports.partyLedger": "पार्टी खाता",
"reports.partyLedgerDesc": "पार्टी-वार लेनदेन विवरण",
"reports.downloadCSV": "CSV डाउनलोड",
"reports.downloadExcel": "Excel डाउनलोड",
"reports.systemCheck": "सिस्टम जांच",
"reports.allBalanced": "सभी एंट्री बैलेंस हैं ✓",
"reports.unbalanced": "अनबैलेंस एंट्री मिलीं — एक्सपोर्ट ब्लॉक",
"reports.selectParty": "पार्टी चुनें",
"reports.exportBlocked": "सभी एंट्री बैलेंस होने तक एक्सपोर्ट ब्लॉक है",
```

---

## Acceptance Criteria for Epic 8

### Journal Engine:
- [ ] Every FINAL sales bill creates a balanced journal entry (Dr Debtors / Cr Sales + Tax)
- [ ] Every payment received creates a balanced journal entry (Dr Cash-Bank / Cr Debtors)
- [ ] Every purchase bill creates a balanced journal entry (Dr Purchase + Tax / Cr Creditors)
- [ ] Every payment made creates a balanced journal entry (Dr Creditors / Cr Cash-Bank)
- [ ] `createJournalEntry` THROWS if debits ≠ credits (cannot proceed)
- [ ] No journal entry has `isBalanced = false` in normal operation
- [ ] DRAFT bills do NOT create journal entries
- [ ] Journal entries are never updated — only append/reversal

### CA Export:
- [ ] Transaction Register CSV downloads with correct Tally column mapping
- [ ] Trial Balance CSV shows per-account debit/credit totals
- [ ] Trial Balance total debits = total credits
- [ ] Export is BLOCKED (HTTP 409) if any unbalanced entries exist
- [ ] Reports page shows balance check status
- [ ] Date range filter works correctly (Indian FY: April–March)
- [ ] Only ADMIN and ACCOUNTANT roles can access reports page and export APIs
- [ ] CSV fields are properly escaped (commas, quotes, newlines)

---

## File Manifest for Epic 8

### New Files

| File | Type |
|------|------|
| `src/lib/chart-of-accounts.ts` | Utility — CoA definitions |
| `src/lib/journal.ts` | Utility — journal recording engine |
| `src/app/api/export/transactions/route.ts` | API Route — CSV export |
| `src/app/api/export/trial-balance/route.ts` | API Route — trial balance |
| `src/app/(app)/reports/page.tsx` | Page — reports dashboard |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add JournalEntry + JournalLine models |
| `src/app/api/bills/route.ts` | Wire journal for sales bills |
| `src/app/api/payments/route.ts` | Wire journal for payments |
| `src/app/api/purchases/route.ts` | Wire journal for purchases |
| `src/components/ui/AppShell.tsx` | Add Reports to nav |
| `src/lib/i18n/translations.ts` | Add report translations |
