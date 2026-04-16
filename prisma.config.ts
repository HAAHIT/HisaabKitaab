// Prisma 7: env vars must be loaded here — not auto-loaded from .env.
// Using DIRECT_URL for migrations because DATABASE_URL is a pgBouncer
// pooler endpoint that cannot run DDL statements (prisma migrate / db pull).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DIRECT_URL"),      // direct PostgreSQL — required for migrate / db pull
  },
});