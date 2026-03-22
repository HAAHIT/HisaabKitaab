export type SupportedPartyType = "CUSTOMER" | "VENDOR";
export type SupportedPayDirection = "INCOMING" | "OUTGOING";

type BillSnapshotSource = {
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
};

type BillSnapshotOverrides = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  gstin?: string | null;
};

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildBillSnapshotFromParty(
  party: BillSnapshotSource,
  overrides: BillSnapshotOverrides
) {
  return {
    customerName: normalizeOptionalString(overrides.customerName) ?? party.name,
    customerPhone: normalizeOptionalString(overrides.customerPhone) ?? party.phone,
    customerAddress:
      normalizeOptionalString(overrides.customerAddress) ?? party.address,
    gstin: normalizeOptionalString(overrides.gstin) ?? party.gstin,
  };
}

export function getPaymentBalanceDelta(
  partyType: SupportedPartyType,
  direction: SupportedPayDirection,
  amount: number
) {
  if (partyType === "CUSTOMER") {
    return direction === "INCOMING" ? -amount : amount;
  }

  return direction === "OUTGOING" ? -amount : amount;
}

export function getSettlementDirectionForParty(
  partyType: SupportedPartyType
): SupportedPayDirection {
  return partyType === "CUSTOMER" ? "INCOMING" : "OUTGOING";
}
