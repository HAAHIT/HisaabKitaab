/**
 * Auth-boundary tests for the admin (SUPERADMIN) routes.
 *
 * We don't exercise the happy paths exhaustively — those depend on a real
 * Prisma. The contract we DO want a regression net for is the security one:
 *   - every admin route refuses callers who are not verified SUPERADMINs
 *   - mutating routes that succeed write an AuditLog row
 *   - impersonation cannot target SUPERADMINs, inactive users, or self,
 *     and exit-impersonation only restores a still-active SUPERADMIN
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const resolveSuperAdminSessionMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
    return typeof cb === "function" ? cb(prismaMock) : cb;
  }),
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/session-server", () => ({
  resolveSuperAdminSession: resolveSuperAdminSessionMock,
}));

const hashPasswordMock = vi.hoisted(() => vi.fn(async (p: string) => `hashed:${p}`));
const signTokenMock = vi.hoisted(() => vi.fn(async () => "signed-token"));
const verifyTokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  hashPassword: hashPasswordMock,
  signToken: signTokenMock,
  verifyToken: verifyTokenMock,
  IMPERSONATION_DURATION: 1800,
}));

// ── Route imports (must come after mocks) ────────────────────────────────────

import { PATCH as patchTenant } from "./tenants/[id]/route";
import { POST as suspendTenant } from "./tenants/[id]/suspend/route";
import { POST as impersonate } from "./tenants/[id]/impersonate/route";
import { POST as exitImpersonation } from "./exit-impersonation/route";
import { PATCH as patchUser } from "./users/[id]/route";
import { POST as resetPassword } from "./users/[id]/reset-password/route";
import { POST as createSuperadmin, GET as listSuperadmins } from "./superadmins/route";
import { DELETE as revokeSuperadmin } from "./superadmins/[id]/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, init: { method: string; body?: unknown; cookies?: Record<string, string> } = { method: "GET" }) {
  const req = new NextRequest(url, {
    method: init.method,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return req;
}

function asSuperadmin() {
  resolveSuperAdminSessionMock.mockResolvedValue({ userId: "sa-1", email: "sa@x.com", name: "SA" });
}

function asNobody() {
  resolveSuperAdminSessionMock.mockResolvedValue(null);
}

beforeEach(() => {
  // Use resetAllMocks (not clearAllMocks) so leftover mockResolvedValueOnce
  // queues do not bleed between tests. We re-establish $transaction's
  // pass-through implementation here because reset wipes it.
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    return typeof cb === "function" ? cb(prismaMock) : cb;
  });
  hashPasswordMock.mockImplementation(async (p: string) => `hashed:${p}`);
  signTokenMock.mockImplementation(async () => "signed-token");
});

// ── Auth boundary ────────────────────────────────────────────────────────────

describe("admin routes — auth boundary", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["PATCH /api/admin/tenants/[id]", () => patchTenant(
      makeRequest("http://x/api/admin/tenants/t1", { method: "PATCH", body: { name: "x" } }),
      { params: Promise.resolve({ id: "t1" }) },
    )],
    ["POST  /api/admin/tenants/[id]/suspend", () => suspendTenant(
      makeRequest("http://x/api/admin/tenants/t1/suspend", { method: "POST", body: { suspend: true } }),
      { params: Promise.resolve({ id: "t1" }) },
    )],
    ["POST  /api/admin/tenants/[id]/impersonate", () => impersonate(
      makeRequest("http://x/api/admin/tenants/t1/impersonate", { method: "POST", body: {} }),
      { params: Promise.resolve({ id: "t1" }) },
    )],
    ["PATCH /api/admin/users/[id]", () => patchUser(
      makeRequest("http://x/api/admin/users/u1", { method: "PATCH", body: { isActive: false } }),
      { params: Promise.resolve({ id: "u1" }) },
    )],
    ["POST  /api/admin/users/[id]/reset-password", () => resetPassword(
      makeRequest("http://x/api/admin/users/u1/reset-password", { method: "POST" }),
      { params: Promise.resolve({ id: "u1" }) },
    )],
    ["GET   /api/admin/superadmins", () => listSuperadmins(
      makeRequest("http://x/api/admin/superadmins", { method: "GET" }),
    )],
    ["POST  /api/admin/superadmins", () => createSuperadmin(
      makeRequest("http://x/api/admin/superadmins", { method: "POST", body: {} }),
    )],
    ["DELETE /api/admin/superadmins/[id]", () => revokeSuperadmin(
      makeRequest("http://x/api/admin/superadmins/sa2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "sa2" }) },
    )],
  ];

  for (const [label, run] of cases) {
    it(`${label} → 403 when caller is not a SUPERADMIN`, async () => {
      asNobody();
      const res = await run();
      expect(res.status).toBe(403);
      // No DB writes when the caller is rejected at the door.
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
      expect(prismaMock.tenant.update).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    });
  }
});

// ── PATCH /api/admin/tenants/[id] ────────────────────────────────────────────

describe("PATCH /api/admin/tenants/[id]", () => {
  it("rejects invalid plan", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1" });
    const res = await patchTenant(
      makeRequest("http://x/api/admin/tenants/t1", { method: "PATCH", body: { plan: "GOLD" } }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(400);
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects empty body", async () => {
    asSuperadmin();
    const res = await patchTenant(
      makeRequest("http://x/api/admin/tenants/t1", { method: "PATCH", body: {} }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("404s when tenant missing", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
    const res = await patchTenant(
      makeRequest("http://x/api/admin/tenants/t1", { method: "PATCH", body: { name: "New" } }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("updates plan and writes audit log", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1" });
    prismaMock.tenant.update.mockResolvedValueOnce({
      id: "t1", name: "Acme", slug: "acme", plan: "PRO",
      email: null, phone: null, gstin: null, isOnboardingComplete: true,
    });
    const res = await patchTenant(
      makeRequest("http://x/api/admin/tenants/t1", { method: "PATCH", body: { plan: "PRO" } }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "t1" },
      data: { plan: "PRO" },
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "t1",
        entityType: "Tenant",
        entityId: "t1",
        userId: "sa-1",
        action: "UPDATE",
        actorType: "SYSTEM",
      }),
    }));
  });
});

// ── POST /api/admin/tenants/[id]/suspend ────────────────────────────────────

describe("POST /api/admin/tenants/[id]/suspend", () => {
  it("suspending sets isActive=false on non-superadmin users only", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1" });
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 3 });

    const res = await suspendTenant(
      makeRequest("http://x/api/admin/tenants/t1/suspend", { method: "POST", body: { suspend: true } }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", role: { not: "SUPERADMIN" } },
      data: { isActive: false },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SUSPEND", actorType: "SYSTEM" }),
    }));
  });

  it("un-suspending sets isActive=true", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1" });
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 3 });
    const res = await suspendTenant(
      makeRequest("http://x/api/admin/tenants/t1/suspend", { method: "POST", body: { suspend: false } }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", role: { not: "SUPERADMIN" } },
      data: { isActive: true },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "UNSUSPEND" }),
    }));
  });
});

// ── PATCH /api/admin/users/[id] ─────────────────────────────────────────────

describe("PATCH /api/admin/users/[id]", () => {
  it("refuses to modify the caller's own account", async () => {
    asSuperadmin();
    const res = await patchUser(
      makeRequest("http://x/api/admin/users/sa-1", { method: "PATCH", body: { isActive: false } }),
      { params: Promise.resolve({ id: "sa-1" }) },
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses to modify another superadmin", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "sa-2", tenantId: "t9", role: "SUPERADMIN" });
    const res = await patchUser(
      makeRequest("http://x/api/admin/users/sa-2", { method: "PATCH", body: { isActive: false } }),
      { params: Promise.resolve({ id: "sa-2" }) },
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("toggles isActive and writes audit log", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1", tenantId: "t1", role: "ADMIN" });
    prismaMock.user.update.mockResolvedValueOnce({ id: "u1", name: "U", email: null, isActive: false, role: "ADMIN" });
    const res = await patchUser(
      makeRequest("http://x/api/admin/users/u1", { method: "PATCH", body: { isActive: false } }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isActive: false },
      select: expect.any(Object),
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entityType: "User", entityId: "u1", action: "UPDATE" }),
    }));
  });
});

// ── POST /api/admin/users/[id]/reset-password ───────────────────────────────

describe("POST /api/admin/users/[id]/reset-password", () => {
  it("404s when user missing", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res = await resetPassword(
      makeRequest("http://x/api/admin/users/u1/reset-password", { method: "POST" }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(404);
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("issues a token, invalidates prior tokens, and audit-logs", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", email: "u@x.com", name: "U", tenantId: "t1", role: "ADMIN",
    });
    prismaMock.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.passwordResetToken.create.mockResolvedValueOnce({ id: "tok-1" });

    const res = await resetPassword(
      makeRequest("http://x/api/admin/users/u1/reset-password", { method: "POST" }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.resetUrl).toMatch(/\/reset-password\?token=/);
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PASSWORD_RESET_ISSUED" }),
    }));
  });
});

// ── Impersonation start ─────────────────────────────────────────────────────

describe("POST /api/admin/tenants/[id]/impersonate", () => {
  it("404s when tenant missing", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
    const res = await impersonate(
      makeRequest("http://x/api/admin/tenants/t1/impersonate", { method: "POST", body: {} }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(404);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("404s when no eligible ADMIN exists", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1", name: "Acme" });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const res = await impersonate(
      makeRequest("http://x/api/admin/tenants/t1/impersonate", { method: "POST", body: {} }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("issues a signed cookie, defaults to read-only, audit logs", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1", name: "Acme" });
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "u1", name: "Admin U", role: "ADMIN", email: null, phone: null, tenantId: "t1",
    });

    const res = await impersonate(
      makeRequest("http://x/api/admin/tenants/t1/impersonate", { method: "POST", body: {} }),
      { params: Promise.resolve({ id: "t1" }) },
    );

    expect(res.status).toBe(200);
    // signToken called once with readOnly=true default and the superadmin's id as impersonatedBy.
    expect(signTokenMock).toHaveBeenCalledTimes(1);
    const [payload, duration] = signTokenMock.mock.calls[0]!;
    expect(payload).toMatchObject({
      userId: "u1",
      role: "ADMIN",
      impersonatedBy: "sa-1",
      readOnly: true,
    });
    expect(duration).toBe(1800);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "IMPERSONATION_START" }),
    }));
    // Session cookie was set on the response.
    expect(res.headers.get("set-cookie")).toMatch(/session/i);
  });

  it("honours readOnly=false (full access)", async () => {
    asSuperadmin();
    prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: "t1", name: "Acme" });
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "u1", name: "Admin U", role: "ADMIN", email: null, phone: null, tenantId: "t1",
    });

    const res = await impersonate(
      makeRequest("http://x/api/admin/tenants/t1/impersonate", { method: "POST", body: { readOnly: false } }),
      { params: Promise.resolve({ id: "t1" }) },
    );

    expect(res.status).toBe(200);
    const [payload] = signTokenMock.mock.calls[0]!;
    expect(payload).toMatchObject({ readOnly: false });
  });
});

// ── Impersonation exit ──────────────────────────────────────────────────────

describe("POST /api/admin/exit-impersonation", () => {
  it("400s when caller is not in an impersonation session", async () => {
    verifyTokenMock.mockResolvedValueOnce({ userId: "u1", tenantId: "t1", role: "ADMIN", name: "U" });
    const req = new NextRequest("http://x/api/admin/exit-impersonation", { method: "POST" });
    req.cookies.set(SESSION_COOKIE_NAME, "tok");
    const res = await exitImpersonation(req);
    expect(res.status).toBe(400);
  });

  it("403s if the impersonatedBy superadmin no longer exists / inactive", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      userId: "u1", tenantId: "t1", role: "ADMIN", name: "U", impersonatedBy: "sa-1",
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "sa-1", role: "SUPERADMIN", isActive: false, tenantId: "tA", email: null, phone: null, name: "SA",
    });
    const req = new NextRequest("http://x/api/admin/exit-impersonation", { method: "POST" });
    req.cookies.set(SESSION_COOKIE_NAME, "tok");
    const res = await exitImpersonation(req);
    expect(res.status).toBe(403);
  });

  it("restores the superadmin session and audit-logs end", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      userId: "u1", tenantId: "t1", role: "ADMIN", name: "U", impersonatedBy: "sa-1",
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "sa-1", role: "SUPERADMIN", isActive: true, tenantId: "tA", email: "sa@x.com", phone: null, name: "SA",
    });

    const req = new NextRequest("http://x/api/admin/exit-impersonation", { method: "POST" });
    req.cookies.set(SESSION_COOKIE_NAME, "tok");
    const res = await exitImpersonation(req);

    expect(res.status).toBe(200);
    expect(signTokenMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "sa-1",
      role: "SUPERADMIN",
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "IMPERSONATION_END", userId: "sa-1" }),
    }));
  });
});

// ── Superadmins create / revoke ─────────────────────────────────────────────

describe("Superadmin management", () => {
  it("POST /api/admin/superadmins rejects short passwords", async () => {
    asSuperadmin();
    const res = await createSuperadmin(makeRequest("http://x/api/admin/superadmins", {
      method: "POST",
      body: { name: "X", email: "x@x.com", password: "short" },
    }));
    expect(res.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("POST /api/admin/superadmins 409s on duplicate email in tenant", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({ tenantId: "tA" });
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "existing" });
    const res = await createSuperadmin(makeRequest("http://x/api/admin/superadmins", {
      method: "POST",
      body: { name: "X", email: "x@x.com", password: "longenoughpassword" },
    }));
    expect(res.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("POST /api/admin/superadmins creates user with SUPERADMIN role and hashed password", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({ tenantId: "tA" });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce({
      id: "new-sa", name: "X", email: "x@x.com", createdAt: new Date(), isActive: true, tenantId: "tA",
    });

    const res = await createSuperadmin(makeRequest("http://x/api/admin/superadmins", {
      method: "POST",
      body: { name: "X", email: "x@x.com", password: "longenoughpassword" },
    }));
    expect(res.status).toBe(200);
    expect(hashPasswordMock).toHaveBeenCalledWith("longenoughpassword");
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: "SUPERADMIN",
        password: "hashed:longenoughpassword",
        tenantId: "tA",
      }),
    }));
  });

  it("DELETE /api/admin/superadmins/[id] refuses self-revoke", async () => {
    asSuperadmin();
    const res = await revokeSuperadmin(
      makeRequest("http://x/api/admin/superadmins/sa-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "sa-1" }) },
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/admin/superadmins/[id] soft-revokes (role→ADMIN, isActive=false)", async () => {
    asSuperadmin();
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "sa-2", role: "SUPERADMIN" });
    prismaMock.user.update.mockResolvedValueOnce({ id: "sa-2" });
    const res = await revokeSuperadmin(
      makeRequest("http://x/api/admin/superadmins/sa-2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "sa-2" }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "sa-2" },
      data: { role: "ADMIN", isActive: false },
    });
  });
});
