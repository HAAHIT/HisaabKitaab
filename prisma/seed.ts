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

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Ensure Tenant exists
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Sadhguru Door",
      slug: "default",
      phone: "9999999999",
      email: "info@sadhgurudoor.com",
      address: "Industrial Area, India",
      settings: {
        billPrefix: "BILL",
        defaultTaxPercent: 18,
        defaultTerms: "1. Delivery in 2-3 weeks.\n2. 50% advance.",
        companyName: "Sadhguru Door",
        companyPhone: "9999999999",
        companyEmail: "info@sadhgurudoor.com",
        companyAddress: "Industrial Area, India",
        companyGstin: "",
      },
    },
  });
  console.log(`✅ Default tenant created/found: ${tenant.id}`);

  const tenantId = tenant.id;

  // ── Admin User ──────────────────────────────────────
  const adminPassword = await bcrypt.hash(
    getSeedPassword("SEED_ADMIN_PASSWORD", "admin123"),
    12
  );
  
  // Need to search by tenantId_email unique constraint
  const adminEmail = "admin@doorcraft.com";
  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId, email: adminEmail }
  });

  let admin;
  if (!existingAdmin) {
    admin = await prisma.user.create({
      data: {
        tenantId,
        name: "Suraj Admin",
        email: adminEmail,
        phone: "9999999999",
        password: adminPassword,
        role: "ADMIN",
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);
  } else {
    admin = existingAdmin;
    console.log(`✅ Admin user exists: ${admin.email}`);
  }

  // ── Sample Bill Template ────────────────────────────
  const existingTemplate = await prisma.billTemplate.findFirst({
    where: { tenantId, name: "Door Order Invoice" }
  });

  if (!existingTemplate) {
    const template = await prisma.billTemplate.create({
      data: {
        tenantId,
        name: "Door Order Invoice",
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
    console.log(`✅ Template created: ${template.name}`);
  }

  // ── Sample Staff user ───────────────────────────────
  const staffEmail = "staff@doorcraft.com";
  const existingStaff = await prisma.user.findFirst({ where: { tenantId, email: staffEmail }});
  
  if (!existingStaff) {
    const staffPassword = await bcrypt.hash(
      getSeedPassword("SEED_STAFF_PASSWORD", "staff123"),
      12
    );
    await prisma.user.create({
      data: {
        tenantId,
        name: "Ravi Staff",
        email: staffEmail,
        phone: "8888888888",
        password: staffPassword,
        role: "STAFF",
        createdBy: admin.id,
      },
    });
    console.log("✅ Staff user created: staff@doorcraft.com");
  }

  // ── Sample Customer user ────────────────────────────
  const custEmail = "rajesh@example.com";
  const existingCust = await prisma.user.findFirst({ where: { tenantId, email: custEmail }});
  
  if (!existingCust) {
    const custPassword = await bcrypt.hash(
      getSeedPassword("SEED_CUSTOMER_PASSWORD", "customer123"),
      12
    );
    await prisma.user.create({
      data: {
        tenantId,
        name: "Rajesh Sharma",
        email: custEmail,
        phone: "7777777777",
        password: custPassword,
        role: "CUSTOMER",
        createdBy: admin.id,
      },
    });
    console.log("✅ Customer user created: rajesh@example.com");
  }

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
