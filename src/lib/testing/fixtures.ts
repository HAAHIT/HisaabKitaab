import { vi } from "vitest";

export function createPrismaMock() {
  return {
    billTemplate: { findFirst: vi.fn() },
    party: { findFirst: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  };
}

export function createMockUser(overrides = {}) {
  return {
    id: "user-1",
    tenantId: "tenant-a",
    name: "Mock User",
    email: "mock@example.com",
    phone: "9999999999",
    role: "ADMIN",
    ...overrides,
  };
}

export function createMockParty(overrides = {}) {
  return {
    id: "party-1",
    tenantId: "tenant-a",
    name: "Mock Party",
    type: "CUSTOMER",
    phone: "9999999999",
    email: "party@example.com",
    address: "Mock Address",
    gstin: "22AAAAA0000A1Z5",
    currentBalance: 0,
    isActive: true,
    ...overrides,
  };
}

export function createMockBill(overrides = {}) {
  return {
    id: "bill-1",
    tenantId: "tenant-a",
    partyId: "party-1",
    status: "FINAL",
    party: { id: "party-1", type: "CUSTOMER" },
    ...overrides,
  };
}
