import { prisma } from "./src/lib/prisma";

async function verify() {
  const template = await prisma.billTemplate.findFirst();
  console.log("Template Columns:");
  console.log(JSON.stringify(template?.columns, null, 2));

  const bill = await prisma.bill.findFirst();
  console.log("\nBill Rows:");
  console.log(JSON.stringify(bill?.rows, null, 2));
}

verify().finally(() => prisma.$disconnect());
