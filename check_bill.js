const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const bill = await prisma.bill.findFirst({
    where: { billNumber: 'BILL-202603-001' },
    include: { template: true }
  })
  console.log("=== TEMPLATE COLUMNS ===")
  console.log(JSON.stringify(bill?.template?.columns, null, 2))
  console.log("\n=== BILL ROWS ===")
  console.log(JSON.stringify(bill?.rows, null, 2))
}
main()
