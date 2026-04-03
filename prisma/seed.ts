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

  // ── Admin User ──────────────────────────────────────
  const adminPassword = await bcrypt.hash(
    getSeedPassword("SEED_ADMIN_PASSWORD", "admin123"),
    12
  );
  const admin = await prisma.user.upsert({
    where: { email: "admin@doorcraft.com" },
    update: {},
    create: {
      name: "Suraj Admin",
      email: "admin@doorcraft.com",
      phone: "9999999999",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ── Sample Bill Template ────────────────────────────
  const template = await prisma.billTemplate.create({
    data: {
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

  // ── Company Settings ────────────────────────────────
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Sadhguru Door",
      companyAddress: "Industrial Area, India",
      companyPhone: "9999999999",
      companyEmail: "info@sadhgurudoor.com",
      defaultTaxPercent: 18,
      defaultTerms:
        "1. Delivery within 2-3 weeks from order confirmation.\n2. 50% advance payment required.\n3. Warranty: 1 year on manufacturing defects.",
      billPrefix: "BILL",
    },
  });
  console.log("✅ Company settings created");

  // ── Sample Staff user ───────────────────────────────
  const staffPassword = await bcrypt.hash(
    getSeedPassword("SEED_STAFF_PASSWORD", "staff123"),
    12
  );
  await prisma.user.upsert({
    where: { email: "staff@doorcraft.com" },
    update: {},
    create: {
      name: "Ravi Staff",
      email: "staff@doorcraft.com",
      phone: "8888888888",
      password: staffPassword,
      role: "STAFF",
      createdBy: admin.id,
    },
  });
  console.log("✅ Staff user created: staff@doorcraft.com");

  // ── Sample Customer user ────────────────────────────
  const custPassword = await bcrypt.hash(
    getSeedPassword("SEED_CUSTOMER_PASSWORD", "customer123"),
    12
  );
  await prisma.user.upsert({
    where: { email: "rajesh@example.com" },
    update: {},
    create: {
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
