-- Add durable auth throttling records for login abuse protection.

CREATE TYPE "AuthThrottleScope" AS ENUM ('IP', 'CREDENTIAL');

CREATE TABLE "AuthThrottle" (
    "id" TEXT NOT NULL,
    "scope" "AuthThrottleScope" NOT NULL,
    "throttleKey" TEXT NOT NULL,
    "userId" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "firstFailureAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthThrottle_scope_throttleKey_key" ON "AuthThrottle"("scope", "throttleKey");
CREATE INDEX "AuthThrottle_blockedUntil_idx" ON "AuthThrottle"("blockedUntil");
CREATE INDEX "AuthThrottle_userId_idx" ON "AuthThrottle"("userId");

ALTER TABLE "AuthThrottle"
ADD CONSTRAINT "AuthThrottle_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
