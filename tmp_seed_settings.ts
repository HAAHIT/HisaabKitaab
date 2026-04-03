import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    console.log('Creating default settings...')
    await prisma.companySettings.create({
      data: {
        id: 'default',
        companyName: 'HisaabKitaab',
        defaultTaxPercent: 18,
      }
    })
  } else {
    console.log('Settings exist:', settings.companyName)
  }
}

main().finally(() => prisma.$disconnect())
