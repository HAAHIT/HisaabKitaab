/**
 * Task 0.2 — Seed Default Tenant & Backfill all existing rows
 *
 * Run order:
 *   1. npx prisma db push           (schema push — adds columns as nullable)
 *   2. npx tsx prisma/seed-tenant.ts  (this script — backfills data)
 *   3. Make tenantId non-nullable in schema (already done — just re-push)
 *   4. npx prisma db push           (enforce NOT NULL)
 *
 * After step 2, copy the printed tenant ID into your .env as DEFAULT_TENANT_ID
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed a default tenant from legacy CompanySettings, backfill missing `tenantId` values, and drop the legacy table.
 *
 * Creates or retrieves the default tenant using values from the legacy `CompanySettings` row (with sensible defaults), updates existing rows in multiple tables to set `tenantId` where it is null, drops the `CompanySettings` table, and prints the created tenant ID and next-step instructions.
 */
async function main() {
  console.log("🌱 Starting tenant seed...\n");

  // 1. Read existing CompanySettings (via raw SQL since the model is being dropped)
  const settingsRows = await prisma.$queryRaw<
    Array<{
      companyName: string;
      companyPhone: string | null;
      companyEmail: string | null;
      companyAddress: string | null;
      companyGstin: string | null;
      billPrefix: string;
      defaultTaxPercent: number;
      defaultTerms: string;
    }>
  >`SELECT * FROM "CompanySettings" WHERE id = 'default' LIMIT 1`.catch(
    () => []
  );

  const s = settingsRows[0] || {};
  console.log(
    "📋 Found existing settings:",
    s.companyName ? `"${s.companyName}"` : "none"
  );

  // 2. Create (or get) the default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: s.companyName || "My Business",
      slug: "default",
      phone: s.companyPhone || null,
      email: s.companyEmail || null,
      address: s.companyAddress || null,
      gstin: s.companyGstin || null,
      settings: {
        billPrefix: s.billPrefix || "BILL",
        defaultTaxPercent: s.defaultTaxPercent ?? 18,
        defaultTerms: s.defaultTerms || "",
        companyName: s.companyName || "",
        companyPhone: s.companyPhone || "",
        companyEmail: s.companyEmail || "",
        companyAddress: s.companyAddress || "",
        companyGstin: s.companyGstin || "",
        upiId: "",
      },
    },
  });

  console.log(`\n✅ Default tenant ready: ${tenant.id}`);
  console.log(`   Name: ${tenant.name}`);

  // 3. Backfill tenantId on all existing rows (safe to run multiple times)
  const tables = [
    "User",
    "BillTemplate",
    "Bill",
    "Party",
    "Payment",
    "MeasurementUpload",
  ];

  console.log("\n📦 Backfilling tenantId on existing rows:");
  for (const table of tables) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "tenantId" = '${tenant.id}' WHERE "tenantId" IS NULL`
    );
    console.log(`   ${table}: updated ${result} rows`);
  }

  // 4. Drop CompanySettings table (data is now in tenant.settings JSON)
  await prisma.$executeRaw`DROP TABLE IF EXISTS "CompanySettings" CASCADE`.catch(
    () => console.log("   CompanySettings already dropped (ok)")
  );
  console.log("\n🗑️  CompanySettings table dropped");

  // 5. Final instructions
  console.log("\n" + "═".repeat(60));
  console.log("✨ DONE! Add this to your .env file:");
  console.log(`\n   DEFAULT_TENANT_ID=${tenant.id}\n`);
  console.log("═".repeat(60));
  console.log("\nThen run: npx prisma db push  (to enforce NOT NULL)\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
