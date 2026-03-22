import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const bill = await prisma.bill.findFirst({
    where: { billNumber: 'BILL-202603-001' },
    include: { template: true }
  })
  console.log("=== TEMPLATE COLUMNS ===")
  console.dir(bill?.template?.columns, { depth: null })
  console.log("\n=== BILL ROWS ===")
  console.dir(bill?.rows, { depth: null })
}
main()
