import { describe, expect, it } from "vitest";
import { paymentModeToAccount } from "@/lib/chart-of-accounts";
import {
  createJournalEntry,
  journalForPaymentMade,
  journalForPaymentReceived,
  journalForSalesBill,
} from "@/lib/journal";

function createFakeTx() {
  const calls: unknown[] = [];

  return {
    calls,
    tx: {
      journalEntry: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        },
      },
    },
  };
}

describe("paymentModeToAccount", () => {
  it("maps bank-like modes to BANK", () => {
    expect(paymentModeToAccount("BANK_TRANSFER")).toBe("BANK");
    expect(paymentModeToAccount("CHEQUE")).toBe("BANK");
    expect(paymentModeToAccount("BANK")).toBe("BANK");
  });
});

describe("createJournalEntry", () => {
  it("rejects unbalanced entries", async () => {
    const { tx } = createFakeTx();

    await expect(
      createJournalEntry(tx as never, {
        tenantId: "tenant_1",
        entryDate: new Date("2026-03-31T10:00:00.000Z"),
        narration: "Broken entry",
        voucherType: "JOURNAL",
        createdBy: "user_1",
        lines: [
          { accountCode: "CASH", debit: 100, credit: 0 },
          { accountCode: "SALES", debit: 0, credit: 80 },
        ],
      })
    ).rejects.toThrow(/UNBALANCED JOURNAL ENTRY/);
  });

  it("rejects lines with both debit and credit", async () => {
    const { tx } = createFakeTx();

    await expect(
      createJournalEntry(tx as never, {
        tenantId: "tenant_1",
        entryDate: new Date("2026-03-31T10:00:00.000Z"),
        narration: "Broken line",
        voucherType: "JOURNAL",
        createdBy: "user_1",
        lines: [{ accountCode: "CASH", debit: 50, credit: 50 }],
      })
    ).rejects.toThrow(/both debit and credit/);
  });
});

describe("journal helpers", () => {
  it("builds a balanced sales bill journal", async () => {
    const { tx, calls } = createFakeTx();

    await journalForSalesBill(tx as never, "tenant_1", {
      id: "bill_1",
      billNumber: "BILL-202603-001",
      partyId: "party_1",
      partyName: "Jignesh",
      subtotal: 1000,
      taxAmount: 180,
      grandTotal: 1180,
      createdBy: "user_1",
      entryDate: new Date("2026-03-31T10:00:00.000Z"),
    });

    const createArgs = calls[0] as {
      data: {
        voucherType: string;
        lines: { create: Array<{ accountCode: string; debit: number; credit: number }> };
      };
    };

    expect(createArgs.data.voucherType).toBe("SALES");
    expect(createArgs.data.lines.create).toEqual([
      expect.objectContaining({
        accountCode: "SUNDRY_DEBTORS",
        debit: 1180,
        credit: 0,
      }),
      expect.objectContaining({
        accountCode: "SALES",
        debit: 0,
        credit: 1000,
      }),
      expect.objectContaining({
        accountCode: "CGST_OUTPUT",
        debit: 0,
        credit: 90,
      }),
      expect.objectContaining({
        accountCode: "SGST_OUTPUT",
        debit: 0,
        credit: 90,
      }),
    ]);
  });

  it("builds a receipt journal for customer payments", async () => {
    const { tx, calls } = createFakeTx();

    await journalForPaymentReceived(tx as never, "tenant_1", {
      id: "payment_1",
      partyId: "party_1",
      partyName: "Jignesh",
      amount: 5000,
      mode: "UPI",
      date: new Date("2026-03-31T10:00:00.000Z"),
      createdBy: "user_1",
    });

    const createArgs = calls[0] as {
      data: {
        voucherType: string;
        lines: { create: Array<{ accountCode: string; debit: number; credit: number }> };
      };
    };

    expect(createArgs.data.voucherType).toBe("RECEIPT");
    expect(createArgs.data.lines.create[0]).toEqual(
      expect.objectContaining({
        accountCode: "UPI",
        debit: 5000,
        credit: 0,
      })
    );
    expect(createArgs.data.lines.create[1]).toEqual(
      expect.objectContaining({
        accountCode: "SUNDRY_DEBTORS",
        debit: 0,
        credit: 5000,
      })
    );
  });

  it("builds a payment journal for vendor settlements", async () => {
    const { tx, calls } = createFakeTx();

    await journalForPaymentMade(tx as never, "tenant_1", {
      id: "payment_1",
      partyId: "party_1",
      partyName: "Palesha",
      amount: 2400,
      mode: "BANK_TRANSFER",
      date: new Date("2026-03-31T10:00:00.000Z"),
      createdBy: "user_1",
    });

    const createArgs = calls[0] as {
      data: {
        voucherType: string;
        lines: { create: Array<{ accountCode: string; debit: number; credit: number }> };
      };
    };

    expect(createArgs.data.voucherType).toBe("PAYMENT");
    expect(createArgs.data.lines.create[0]).toEqual(
      expect.objectContaining({
        accountCode: "SUNDRY_CREDITORS",
        debit: 2400,
        credit: 0,
      })
    );
    expect(createArgs.data.lines.create[1]).toEqual(
      expect.objectContaining({
        accountCode: "BANK",
        debit: 0,
        credit: 2400,
      })
    );
  });
});
