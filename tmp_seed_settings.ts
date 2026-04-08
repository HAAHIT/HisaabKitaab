import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/**
 * Ensures a default company settings record exists in the database, creating it if missing.
 *
 * If no settings record with id `'default'` is found, creates one with `companyName` set to `'HisaabKitaab'` and `defaultTaxPercent` set to `18`; otherwise logs the existing company name.
 */
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
