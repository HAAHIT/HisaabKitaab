import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // [S-I1] Explicit pool config to prevent connection exhaustion under
  // serverless cold-start patterns. Overridable via environment variables.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.PG_POOL_MAX || "10", 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || "30000", 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT_MS || "5000", 10),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
