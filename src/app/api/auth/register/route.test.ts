import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const transactionMock = vi.hoisted(() => vi.fn((cb) => cb(prismaMock)));
const createTenantMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const findUniqueTenantMock = vi.hoisted(() => vi.fn());
const findFirstUserMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  $transaction: transactionMock,
  tenant: {
    create: createTenantMock,
    findUnique: findUniqueTenantMock,
  },
  user: {
    create: createUserMock,
    findFirst: findFirstUserMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const hashPasswordMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  hashPassword: hashPasswordMock,
  createSession: createSessionMock,
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it("fails when required fields are missing", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Name",
        // missing email/phone, password, companyName
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Name, email or phone, password, and company name are required");
  });

  it("fails when password is too short", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Name",
        email: "test@example.com",
        password: "short",
        companyName: "Acme",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Password must be at least 12 characters");
  });

  it("fails when email is already registered", async () => {
    findFirstUserMock.mockResolvedValueOnce({ id: "existing-user" });

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Name",
        email: "test@example.com",
        password: "securepassword123",
        companyName: "Acme",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    
    const data = await response.json();
    expect(data.error).toBe("Email is already registered");
    expect(findFirstUserMock).toHaveBeenCalledWith({
      where: { email: { equals: "test@example.com", mode: "insensitive" } }
    });
  });

  it("fails when phone is already registered", async () => {
    // Only phone is checked since email is undefined
    findFirstUserMock.mockResolvedValueOnce({ id: "existing-user" });

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Name",
        phone: "9876543210",
        password: "securepassword123",
        companyName: "Acme",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    
    const data = await response.json();
    expect(data.error).toBe("Phone number is already registered");
    expect(findFirstUserMock).toHaveBeenCalledWith({
      where: { phone: "9876543210" }
    });
  });

  it("successfully creates tenant and user atomically", async () => {
    findFirstUserMock.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue("hashed-password-123");
    
    // Simulate no existing tenant slug
    findUniqueTenantMock.mockResolvedValue(null);

    // Mocks for returned structures from Prisma
    createTenantMock.mockResolvedValue({ id: "tenant-id-1", slug: "acme-corp" });
    createUserMock.mockResolvedValue({
      id: "user-id-1",
      tenantId: "tenant-id-1",
      name: "John Doe",
      email: "john@acme.com",
      role: "ADMIN",
    });

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "John Doe",
        email: "john@acme.com",
        password: "securepassword123",
        companyName: "Acme Corp",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify slug checking
    expect(findUniqueTenantMock).toHaveBeenCalledWith({
      where: { slug: "acme-corp" },
    });

    // Verify password hashing
    expect(hashPasswordMock).toHaveBeenCalledWith("securepassword123");

    // Verify atomic transaction was called
    expect(transactionMock).toHaveBeenCalled();
    expect(createTenantMock).toHaveBeenCalledWith({
      data: {
        name: "Acme Corp",
        slug: "acme-corp",
        settings: { companyName: "Acme Corp" },
      },
    });

    expect(createUserMock).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-id-1",
        name: "John Doe",
        email: "john@acme.com",
        phone: null,
        password: "hashed-password-123",
        role: "ADMIN",
        isActive: true,
      },
    });

    // Verify automatic sign-in
    expect(createSessionMock).toHaveBeenCalledWith({
      userId: "user-id-1",
      tenantId: "tenant-id-1",
      name: "John Doe",
      role: "ADMIN",
      email: "john@acme.com",
      phone: undefined,
    });
  });
});
