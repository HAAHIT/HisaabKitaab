import { TallyVoucher } from "@/lib/tally-xml";

export function buildMockBill(overrides: any = {}) {
  return {
    id: "bill-1",
    billNumber: "BILL-202401-001",
    partyId: "party-1",
    party: { id: "party-1", name: "Acme", type: "CUSTOMER" },
    customerName: "Acme",
    grandTotal: 1180,
    status: "FINAL",
    createdAt: new Date("2024-01-15"),
    ...overrides,
  };
}

export function buildMockParty(overrides: any = {}) {
  return {
    id: "party-1", 
    name: "Test Co", 
    type: "CUSTOMER",
    phone: null, 
    address: null, 
    gstin: null,
    ...overrides,
  };
}

export function buildMockTenant(overrides: any = {}) {
  return {
    id: "test-tenant",
    settings: {},
    gstin: null,
    // Quota state — checkBillQuota()/checkPartyQuota() read these via
    // getQuotaState(); usageWindowStart must be a Date or .getTime() throws.
    plan: "FREE",
    trialEndsAt: null,
    monthlyBillCount: 0,
    monthlyPartyCount: 0,
    usageWindowStart: new Date(),
    ...overrides,
  };
}

export function buildMockTallySalesVoucher(overrides?: Partial<TallyVoucher>): TallyVoucher {
  return {
    date: new Date("2025-04-01T06:30:00.000Z"), // IST noon
    voucherType: "Sales",
    reference: "INV-001",
    narration: "Sale to Test Party",
    ledgerEntries: [
      { ledgerName: "Sundry Debtors", amount: 11800, partyName: "Test Party" },
      { ledgerName: "Sales Account", amount: -10000, isIncomeLedger: true },
      { ledgerName: "CGST Output", amount: -900 },
      { ledgerName: "SGST Output", amount: -900 },
    ],
    guid: "test-guid-001",
    placeOfSupply: "27",
    taxPercent: 18,
    isInterState: false,
    cessAmount: 0,
    hsnRatePairs: [{ hsnCode: "6204", taxPercent: 18 }],
    hsnCodes: ["6204"],
    gstin: "27AABCU9603R1ZM",
    ...overrides,
  };
}
