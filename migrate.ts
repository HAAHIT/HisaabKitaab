import { prisma } from "./src/lib/prisma";
import crypto from "crypto";

function extractReferences(formula: string) {
  if (typeof formula !== "string") return [];
  const matches = formula.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

function escapeRegex(str: string) {
  if (!str) return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  console.log("Migration Starting...");

  const templates = await prisma.billTemplate.findMany();

  for (const template of templates) {
    console.log(`\nMigrating Template: ${template.name}`);
    let columns: any[] = [];
    try {
      columns =
        typeof template.columns === "string"
          ? JSON.parse(template.columns)
          : template.columns;
    } catch (e) {
      console.log(`Could not parse columns for ${template.name}`);
      continue;
    }

    if (!Array.isArray(columns)) columns = [];

    for (const col of columns) {
      if (!col.id) {
        col.id = crypto.randomUUID();
      }
    }

    for (const col of columns) {
      if (col.type === "formula" && col.formula) {
        let newFormula = String(col.formula);
        const refs = extractReferences(newFormula);
        for (const ref of refs) {
          const targetCol = columns.find((c) => c.name === ref);
          if (targetCol && targetCol.id) {
            newFormula = newFormula.replace(
              new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"),
              `{${targetCol.id}}`
            );
          }
        }
        col.formula = newFormula;
      }
    }

    await prisma.billTemplate.update({
      where: { id: template.id },
      data: { columns },
    });

    const bills = await prisma.bill.findMany({
      where: { templateId: template.id },
    });

    for (const bill of bills) {
      console.log(`  -> Migrating Bill: ${bill.billNumber}`);
      let rows: any[] = [];
      if (typeof bill.rows === "string") {
        try {
          rows = JSON.parse(bill.rows);
        } catch (e) {
          rows = [];
        }
      } else {
        rows = (bill.rows as any[]) || [];
      }
      if (!Array.isArray(rows)) rows = [];

      const upgradedRows = rows.map((row) => {
        const newRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          const targetCol = columns.find((c) => c.name === key);
          if (targetCol && targetCol.id) {
            newRow[targetCol.id] = value;
          } else {
            newRow[key] = value;
          }
        }
        return newRow;
      });

      await prisma.bill.update({
        where: { id: bill.id },
        data: { rows: upgradedRows },
      });
    }
  }

  console.log("\n✅ Migration Complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
