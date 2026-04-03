import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getSeedPassword(envKey: string, fallback: string) {
  const value = process.env[envKey]?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${envKey} must be provided when seeding in production. Refusing to use demo passwords.`
    );
  }

  return fallback;
}

function resolveSeedTenantId() {
  const fromSeed = process.env.SEED_TENANT_ID?.trim();
  if (fromSeed) {
    return fromSeed;
  }

  const fromDefault = process.env.DEFAULT_TENANT_ID?.trim();
  if (fromDefault) {
    return fromDefault;
  }

  return "default";
}

function resolveSeedTenantSlug() {
  const fromSeed = process.env.SEED_TENANT_SLUG?.trim();
  if (fromSeed) {
    return fromSeed;
  }

  return "hisaabkitaab";
}

async function ensureSeedTenant() {
  const explicitTenantId = resolveSeedTenantId();
  const existingById = await prisma.tenant.findUnique({
    where: { id: explicitTenantId },
  });
  if (existingById) {
    return existingById;
  }

  const existingFirst = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existingFirst) {
    return existingFirst;
  }

  const now = new Date();
  const slug = resolveSeedTenantSlug();
  const existingBySlug = await prisma.tenant.findUnique({
    where: { slug },
  });
  if (existingBySlug) {
    return existingBySlug;
  }

  return prisma.tenant.create({
    data: {
      id: explicitTenantId,
      name: "HisaabKitaab",
      slug,
      phone: "9999999999",
      email: "info@hisaabkitaab.com",
      address: "Industrial Area, India",
      gstin: null,
      settings: {},
      plan: "FREE",
      createdAt: now,
      updatedAt: now,
    },
  });
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

async function main() {
  console.log("🌱 Seeding database...");
  const tenant = await ensureSeedTenant();
  console.log(`✅ Tenant ready: ${tenant.id}`);

  // ── Admin User ──────────────────────────────────────
  const adminPassword = await bcrypt.hash(
    getSeedPassword("SEED_ADMIN_PASSWORD", "admin123"),
    12
  );
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@hisaabkitaab.com",
      },
    },
    update: {
      name: "Suraj Admin",
      phone: "9999999999",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: "Suraj Admin",
      email: "admin@hisaabkitaab.com",
      phone: "9999999999",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ── Sample Bill Template ────────────────────────────
  const existingTemplate = await prisma.billTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: "Order Invoice",
      isDeleted: false,
    },
    orderBy: { createdAt: "asc" },
  });
  const template =
    existingTemplate ||
    (await prisma.billTemplate.create({
      data: {
        tenantId: tenant.id,
        name: "Order Invoice",
        createdBy: admin.id,
        columns: [
          { id: "desc-col-001", name: "Description", type: "text", position: 0 },
          { id: "qty-col-002", name: "Qty", type: "number", position: 1 },
          { id: "rate-col-003", name: "Rate (₹)", type: "number", position: 2 },
          {
            id: "amount-col-004",
            name: "Amount",
            type: "formula",
            position: 3,
            formula: "{qty-col-002} * {rate-col-003}",
          },
          {
            id: "disc-col-005",
            name: "Discount %",
            type: "number",
            position: 4,
          },
          {
            id: "net-col-006",
            name: "Net Amount",
            type: "formula",
            position: 5,
            formula:
              "{amount-col-004} - ({amount-col-004} * {disc-col-005} / 100)",
          },
        ],
      },
    }));
  console.log(`✅ Template ready: ${template.name}`);

  // ── Tenant Settings ─────────────────────────────────
  const mergedTenantSettings = {
    ...parseJsonObject(tenant.settings),
    defaultTaxPercent: 18,
    defaultTerms:
      "1. Delivery within 2-3 weeks from order confirmation.\n2. 50% advance payment required.\n3. Warranty: 1 year on manufacturing defects.",
    billPrefix: "BILL",
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: "HisaabKitaab",
      address: "Industrial Area, India",
      phone: "9999999999",
      email: "info@hisaabkitaab.com",
      settings: mergedTenantSettings,
      updatedAt: new Date(),
    },
  });
  console.log("✅ Tenant settings updated");

  // ── Sample Staff user ───────────────────────────────
  const staffPassword = await bcrypt.hash(
    getSeedPassword("SEED_STAFF_PASSWORD", "staff123"),
    12
  );
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "staff@hisaabkitaab.com",
      },
    },
    update: {
      name: "Ravi Staff",
      phone: "8888888888",
      password: staffPassword,
      role: "STAFF",
      createdBy: admin.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: "Ravi Staff",
      email: "staff@hisaabkitaab.com",
      phone: "8888888888",
      password: staffPassword,
      role: "STAFF",
      createdBy: admin.id,
    },
  });
  console.log("✅ Staff user created: staff@hisaabkitaab.com");

  // ── Sample Customer user ────────────────────────────
  const custPassword = await bcrypt.hash(
    getSeedPassword("SEED_CUSTOMER_PASSWORD", "customer123"),
    12
  );
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "rajesh@example.com",
      },
    },
    update: {
      name: "Rajesh Sharma",
      phone: "7777777777",
      password: custPassword,
      role: "CUSTOMER",
      createdBy: admin.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: "Rajesh Sharma",
      email: "rajesh@example.com",
      phone: "7777777777",
      password: custPassword,
      role: "CUSTOMER",
      createdBy: admin.id,
    },
  });
  console.log("✅ Customer user created: rajesh@example.com");

  console.log("\n🎉 Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
