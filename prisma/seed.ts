import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin User ──────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12);
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
        { name: "Description", type: "text", position: 0 },
        { name: "Qty", type: "number", position: 1 },
        { name: "Rate (₹)", type: "number", position: 2 },
        {
          name: "Amount",
          type: "formula",
          position: 3,
          formula: "{Qty} * {Rate (₹)}",
        },
        { name: "Discount %", type: "number", position: 4 },
        {
          name: "Net Amount",
          type: "formula",
          position: 5,
          formula: "{Amount} - ({Amount} * {Discount %} / 100)",
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
  const staffPassword = await bcrypt.hash("staff123", 12);
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
  const custPassword = await bcrypt.hash("customer123", 12);
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
