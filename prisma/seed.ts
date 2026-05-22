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
  return "solobooks";
}

async function ensureSeedTenant() {
  const explicitTenantId = resolveSeedTenantId();
  const existingById = await prisma.tenant.findUnique({
    where: { id: explicitTenantId },
  });
  if (existingById) {
    return existingById;
  }

  const slug = resolveSeedTenantSlug();
  const existingBySlug = await prisma.tenant.findUnique({
    where: { slug },
  });
  if (existingBySlug) {
    return existingBySlug;
  }

  const now = new Date();
  return prisma.tenant.create({
    data: {
      id: explicitTenantId,
      name: "SoloBooks",
      slug,
      phone: "9999999999",
      email: "info@solobooks.com",
      address: "Industrial Area, India",
      gstin: null,
      settings: {
        billPrefix: "BILL",
        defaultTaxPercent: 18,
        defaultTerms: "1. Delivery within 2-3 weeks from order confirmation.\n2. 50% advance payment required.\n3. Warranty: 1 year on manufacturing defects.",
        companyName: "SoloBooks",
        companyPhone: "9999999999",
        companyEmail: "info@solobooks.com",
        companyAddress: "Industrial Area, India",
        companyGstin: "",
      },
      plan: "FREE",
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function main() {
  console.log("🌱 Seeding database...");
  const tenant = await ensureSeedTenant();
  console.log(`✅ Tenant ready: ${tenant.id} (${tenant.name})`);

  const tenantId = tenant.id;

  // ── Admin User ──────────────────────────────────────
  const adminPassword = await bcrypt.hash(
    getSeedPassword("SEED_ADMIN_PASSWORD", "admin123"),
    12
  );
  
  const adminEmail = "admin@solobooks.com";
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: adminEmail,
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
      tenantId,
      name: "Suraj Admin",
      email: adminEmail,
      phone: "9999999999",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin user ready: ${admin.email}`);

  // ── Sample Bill Template ────────────────────────────
  const existingTemplate = await prisma.billTemplate.findFirst({
    where: {
      tenantId,
      name: "Order Invoice",
      isDeleted: false,
    },
    orderBy: { createdAt: "asc" },
  });

  const template = existingTemplate || await prisma.billTemplate.create({
    data: {
      tenantId,
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
        { id: "disc-col-005", name: "Discount %", type: "number", position: 4 },
        {
          id: "net-col-006",
          name: "Net Amount",
          type: "formula",
          position: 5,
          formula: "{amount-col-004} - ({amount-col-004} * {disc-col-005} / 100)",
        },
      ],
    },
  });
  console.log(`✅ Template ready: ${template.name}`);

  // ── Sample Staff user ───────────────────────────────
  const staffEmail = "staff@solobooks.com";
  const staffPassword = await bcrypt.hash(
    getSeedPassword("SEED_STAFF_PASSWORD", "staff123"),
    12
  );
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: staffEmail,
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
      tenantId,
      name: "Ravi Staff",
      email: staffEmail,
      phone: "8888888888",
      password: staffPassword,
      role: "STAFF",
      createdBy: admin.id,
    },
  });
  console.log(`✅ Staff user ready: ${staffEmail}`);

  // ── Sample Customer user ────────────────────────────
  const custEmail = "rajesh@example.com";
  const custPassword = await bcrypt.hash(
    getSeedPassword("SEED_CUSTOMER_PASSWORD", "customer123"),
    12
  );
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: custEmail,
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
      tenantId,
      name: "Rajesh Sharma",
      email: custEmail,
      phone: "7777777777",
      password: custPassword,
      role: "CUSTOMER",
      createdBy: admin.id,
    },
  });
  console.log(`✅ Customer user ready: ${custEmail}`);

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
