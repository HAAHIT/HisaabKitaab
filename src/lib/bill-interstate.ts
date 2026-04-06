import type { Prisma, PrismaClient } from "@prisma/client";

type BillSqlClient = PrismaClient | Prisma.TransactionClient;

type BillInterStateRow = {
  isInterState: boolean | null;
};

function isMissingInterStateColumnError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("isinterstate") &&
    (message.includes("does not exist") ||
      message.includes("unknown column") ||
      message.includes("invalid"))
  );
}

export async function readBillInterStateFlag(
  db: BillSqlClient,
  billId: string,
  tenantId: string
) {
  try {
    const rows = await db.$queryRaw<BillInterStateRow[]>`
      SELECT "isInterState"
      FROM "Bill"
      WHERE "id" = ${billId} AND "tenantId" = ${tenantId}
      LIMIT 1
    `;

    return rows[0]?.isInterState === true;
  } catch (error) {
    if (isMissingInterStateColumnError(error)) {
      return false;
    }
    throw error;
  }
}

export async function writeBillInterStateFlag(
  db: BillSqlClient,
  billId: string,
  tenantId: string,
  isInterState: boolean
) {
  try {
    await db.$executeRaw`
      UPDATE "Bill"
      SET "isInterState" = ${isInterState}
      WHERE "id" = ${billId} AND "tenantId" = ${tenantId}
    `;
  } catch (error) {
    if (isMissingInterStateColumnError(error)) {
      return;
    }
    throw error;
  }
}
