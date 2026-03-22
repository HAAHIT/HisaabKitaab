import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const bills = await prisma.bill.findMany({
      take: 5
    })
    console.log('BILLS_IN_DB:', JSON.stringify(bills))
    
    const count = await prisma.bill.count()
    console.log('BILL_COUNT:', count)
  } catch (e) {
    console.error('PRISMA_CHECK_ERROR:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
