import { describe, expect, it } from "vitest";
import {
  buildPartyLedger,
  getBalanceIndicator,
  getBalanceStatusLabel,
  getBillBalanceDeltaForTransition,
  getPostedBillBalanceDelta,
  getLedgerAmountsForBalanceDelta,
  getPaymentBalanceDelta,
} from "./accounting";

describe("accounting helpers", () => {
  it("maps customer payment directions to balance deltas", () => {
    expect(getPaymentBalanceDelta("CUSTOMER", "INCOMING", 1000)).toBe(1000);
    expect(getPaymentBalanceDelta("CUSTOMER", "OUTGOING", 1000)).toBe(-1000);
  });

  it("maps vendor payment directions to balance deltas", () => {
    expect(getPaymentBalanceDelta("VENDOR", "OUTGOING", 1000)).toBe(1000);
    expect(getPaymentBalanceDelta("VENDOR", "INCOMING", 1000)).toBe(-1000);
  });

  it("applies bill balance deltas only to final bills", () => {
    expect(getPostedBillBalanceDelta("CUSTOMER", "DRAFT", 1000)).toBe(0);
    expect(getPostedBillBalanceDelta("CUSTOMER", "FINAL", 1000)).toBe(-1000);
    expect(getPostedBillBalanceDelta("CUSTOMER", "CANCELLED", 1000)).toBe(0);
  });

  it("derives bill transition balance changes correctly", () => {
    expect(
      getBillBalanceDeltaForTransition({
        partyType: "CUSTOMER",
        previousStatus: "DRAFT",
        previousAmount: 0,
        nextStatus: "FINAL",
        nextAmount: 5000,
      })
    ).toBe(-5000);

    expect(
      getBillBalanceDeltaForTransition({
        partyType: "CUSTOMER",
        previousStatus: "FINAL",
        previousAmount: 5000,
        nextStatus: "CANCELLED",
        nextAmount: 5000,
      })
    ).toBe(5000);
  });

  it("maps customer balance deltas to debit and credit columns", () => {
    expect(getLedgerAmountsForBalanceDelta("CUSTOMER", 2500)).toEqual({
      debit: 0,
      credit: 2500,
    });
    expect(getLedgerAmountsForBalanceDelta("CUSTOMER", -2500)).toEqual({
      debit: 2500,
      credit: 0,
    });
  });

  it("maps vendor balance deltas to debit and credit columns", () => {
    expect(getLedgerAmountsForBalanceDelta("VENDOR", 2500)).toEqual({
      debit: 2500,
      credit: 0,
    });
    expect(getLedgerAmountsForBalanceDelta("VENDOR", -2500)).toEqual({
      debit: 0,
      credit: 2500,
    });
  });

  it("returns balance indicators and labels using party semantics", () => {
    expect(getBalanceIndicator("CUSTOMER", 100)).toBe("Cr");
    expect(getBalanceIndicator("CUSTOMER", -100)).toBe("Dr");
    expect(getBalanceIndicator("VENDOR", 100)).toBe("Dr");
    expect(getBalanceIndicator("VENDOR", -100)).toBe("Cr");
    expect(getBalanceIndicator("CUSTOMER", 0)).toBeNull();

    expect(getBalanceStatusLabel("CUSTOMER", 100)).toBe("advance balance");
    expect(getBalanceStatusLabel("VENDOR", 100)).toBe("advance balance");
    expect(getBalanceStatusLabel("CUSTOMER", -100)).toBe("to receive");
    expect(getBalanceStatusLabel("CUSTOMER", 0)).toBe("settled");
  });
});

describe("buildPartyLedger", () => {
  it("uses payment direction instead of assuming all customer payments are received", () => {
    const { ledger, calculatedCurrent } = buildPartyLedger({
      partyType: "CUSTOMER",
      openingBalance: 5000,
      createdAt: new Date("2026-03-22T00:00:00.000Z"),
      bills: [],
      payments: [
        {
          id: "payment-1",
          amount: 95000,
          direction: "INCOMING",
          mode: "CASH",
          date: new Date("2026-03-22T01:00:00.000Z"),
        },
        {
          id: "payment-2",
          amount: 5000,
          direction: "OUTGOING",
          mode: "CASH",
          date: new Date("2026-03-22T02:00:00.000Z"),
        },
        {
          id: "payment-3",
          amount: 20000,
          direction: "OUTGOING",
          mode: "CASH",
          date: new Date("2026-03-22T03:00:00.000Z"),
        },
      ],
    });

    expect(calculatedCurrent).toBe(75000);
    expect(ledger).toHaveLength(4);
    expect(ledger[0]).toMatchObject({
      description: "Opening Balance",
      debit: 0,
      credit: 5000,
      balanceAfter: 5000,
    });
    expect(ledger[1]).toMatchObject({
      description: "Payment Received (CASH)",
      debit: 0,
      credit: 95000,
      balanceAfter: 100000,
    });
    expect(ledger[2]).toMatchObject({
      description: "Payment Paid (CASH)",
      debit: 5000,
      credit: 0,
      balanceAfter: 95000,
    });
    expect(ledger[3]).toMatchObject({
      description: "Payment Paid (CASH)",
      debit: 20000,
      credit: 0,
      balanceAfter: 75000,
    });
  });

  it("keeps vendor bill and payment entries on the correct sides", () => {
    const { ledger, calculatedCurrent } = buildPartyLedger({
      partyType: "VENDOR",
      openingBalance: 10000,
      createdAt: new Date("2026-03-22T00:00:00.000Z"),
      bills: [
        {
          id: "bill-1",
          billNumber: "PB-001",
          grandTotal: 5000,
          date: new Date("2026-03-22T01:00:00.000Z"),
        },
      ],
      payments: [
        {
          id: "payment-1",
          amount: 3000,
          direction: "OUTGOING",
          mode: "BANK_TRANSFER",
          date: new Date("2026-03-22T02:00:00.000Z"),
        },
      ],
    });

    expect(calculatedCurrent).toBe(8000);
    expect(ledger[0]).toMatchObject({
      description: "Opening Balance",
      debit: 10000,
      credit: 0,
      balanceAfter: 10000,
    });
    expect(ledger[1]).toMatchObject({
      description: "Purchase Bill #PB-001",
      debit: 0,
      credit: 5000,
      balanceAfter: 5000,
    });
    expect(ledger[2]).toMatchObject({
      description: "Payment Paid (BANK_TRANSFER)",
      debit: 3000,
      credit: 0,
      balanceAfter: 8000,
    });
  });
});
