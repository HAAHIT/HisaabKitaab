const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const prisma = new PrismaClient();

function extractReferences(formula) {
  if (typeof formula !== 'string') return [];
  const matches = formula.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

function escapeRegex(str) {
  if (!str) return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  console.log("Migration Starting...");

  // 1. Fetch all templates
  const templates = await prisma.template.findMany();
  
  for (const template of templates) {
    let columns = template.columns;
    if (typeof columns === 'string') {
      columns = JSON.parse(columns);
    }
    if (!Array.isArray(columns)) columns = [];
    
    // Assign IDs to columns if they don't have one
    for (const col of columns) {
      if (!col.id) {
        col.id = crypto.randomUUID();
      }
    }

    // Upgrade the formulas inside the template
    for (const col of columns) {
      if (col.type === 'formula' && col.formula) {
        let newFormula = String(col.formula);
        const refs = extractReferences(newFormula);
        for (const ref of refs) {
           const targetCol = columns.find(c => c.name === ref);
           if (targetCol && targetCol.id) {
             newFormula = newFormula.replace(new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"), `{${targetCol.id}}`);
           }
        }
        col.formula = newFormula;
      }
    }

    // Update the Template in DB
    await prisma.template.update({
      where: { id: template.id },
      data: { columns }
    });

    // 2. Fetch all bills using THIS template
    const bills = await prisma.bill.findMany({
      where: { templateId: template.id }
    });

    for (const bill of bills) {
      let rows = bill.rows || [];
      if (typeof rows === 'string') {
        try { rows = JSON.parse(rows); } catch(e) { rows = []; }
      }
      if (!Array.isArray(rows)) rows = [];

      // Convert each row's keys from column names to column IDs
      const upgradedRows = rows.map(row => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
          const targetCol = columns.find(c => c.name === key);
          if (targetCol && targetCol.id) {
            newRow[targetCol.id] = value;
          } else {
            newRow[key] = value;
          }
        }
        return newRow;
      });

      // Update the bill
      await prisma.bill.update({
        where: { id: bill.id },
        data: { rows: upgradedRows }
      });
    }
  }

  console.log("Migration Complete!");
}

main().catch(e => {
  fs.writeFileSync('error.txt', e.stack);
  console.error("Wrote error to error.txt");
}).finally(() => prisma.$disconnect());
