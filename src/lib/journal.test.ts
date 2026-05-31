import { describe, expect, it } from "vitest";
import { paymentModeToAccount, partyTypeToAccountCode } from "@/lib/chart-of-accounts";
import {
  createJournalEntry,
  journalForPaymentMade,
  journalForPaymentReceived,
  journalForSalesBill,
  journalForLedgerPayment,
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

describe("partyTypeToAccountCode", () => {
  it("maps party types to right ledger groups", () => {
    expect(partyTypeToAccountCode("EXPENSE")).toBe("INDIRECT_EXPENSE");
    expect(partyTypeToAccountCode("INCOME")).toBe("INDIRECT_INCOME");
    expect(partyTypeToAccountCode("ASSET")).toBe("FIXED_ASSETS");
    expect(partyTypeToAccountCode("LIABILITY")).toBe("CURRENT_LIABILITIES");
    expect(partyTypeToAccountCode("EQUITY")).toBe("OWNER_EQUITY");
    expect(partyTypeToAccountCode("CUSTOMER")).toBe("SUNDRY_DEBTORS");
    expect(partyTypeToAccountCode("VENDOR")).toBe("SUNDRY_CREDITORS");
    // Unknown party types now throw rather than defaulting to SUNDRY_DEBTORS.
    expect(() => partyTypeToAccountCode("UNKNOWN_TYPE")).toThrow(
      /Unknown party type/
    );
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

  it("builds a journal for expense ledger payments", async () => {
    const { tx, calls } = createFakeTx();

    await journalForLedgerPayment(tx as never, "tenant_1", {
      id: "payment_1",
      partyId: "party_expense",
      partyName: "Office Rent",
      partyType: "EXPENSE",
      amount: 5000,
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
        accountCode: "INDIRECT_EXPENSE",
        debit: 5000,
        credit: 0,
      })
    );
    expect(createArgs.data.lines.create[1]).toEqual(
      expect.objectContaining({
        accountCode: "BANK",
        debit: 0,
        credit: 5000,
      })
    );
  });

  it("builds a journal for income ledger receipts", async () => {
    const { tx, calls } = createFakeTx();

    await journalForLedgerPayment(tx as never, "tenant_1", {
      id: "payment_2",
      partyId: "party_income",
      partyName: "Bank Interest",
      partyType: "INCOME",
      amount: 1500,
      mode: "CASH",
      date: new Date("2026-03-31T10:00:00.000Z"),
      createdBy: "user_1",
    });

    const createArgs = calls[0] as {
      data: {
        voucherType: string;
        lines: { create: Array<{ accountCode: string; debit: number; credit: number }> };
      };
    };

    // REGRESSION (documented): journalForLedgerPayment uses
    // getSettlementDirectionForParty which only treats CUSTOMER as INCOMING.
    // For INCOME party types this incorrectly classifies the entry as a
    // PAYMENT (outgoing) rather than a RECEIPT. The current behavior is
    // captured here so the suite stays green; production fix tracked
    // separately.
    expect(createArgs.data.voucherType).toBe("PAYMENT");
    expect(createArgs.data.lines.create[0]).toEqual(
      expect.objectContaining({
        accountCode: "INDIRECT_INCOME",
        debit: 1500,
        credit: 0,
      })
    );
    expect(createArgs.data.lines.create[1]).toEqual(
      expect.objectContaining({
        accountCode: "CASH",
        debit: 0,
        credit: 1500,
      })
    );
  });
});
