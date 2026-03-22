import { createHash } from "crypto";
import type { AuthThrottle, AuthThrottleScope, PrismaClient } from "@prisma/client";

const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

const THROTTLE_LIMITS: Record<AuthThrottleScope, number> = {
  IP: 10,
  CREDENTIAL: 5,
};

type LoginThrottleRecord = Pick<
  AuthThrottle,
  "scope" | "throttleKey" | "failureCount" | "firstFailureAt" | "lastAttemptAt" | "blockedUntil"
>;

type LoginThrottleTarget = {
  scope: AuthThrottleScope;
  throttleKey: string;
  limit: number;
};

function normalizeCredential(credential: string) {
  return credential.trim().toLowerCase();
}

function hashThrottleKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildThrottleTargets({
  credential,
  ip,
}: {
  credential: string;
  ip: string;
}): LoginThrottleTarget[] {
  return [
    {
      scope: "IP",
      throttleKey: hashThrottleKey(ip.trim() || "unknown"),
      limit: THROTTLE_LIMITS.IP,
    },
    {
      scope: "CREDENTIAL",
      throttleKey: hashThrottleKey(normalizeCredential(credential)),
      limit: THROTTLE_LIMITS.CREDENTIAL,
    },
  ];
}

export function getRetryAfterSeconds(blockedUntil: Date | null, now = new Date()) {
  if (!blockedUntil) {
    return 0;
  }

  const diffMs = blockedUntil.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / 1000);
}

export function isThrottleBlocked(
  record: Pick<LoginThrottleRecord, "blockedUntil"> | null | undefined,
  now = new Date()
) {
  return Boolean(
    record?.blockedUntil && record.blockedUntil.getTime() > now.getTime()
  );
}

function shouldResetThrottleRecord(
  record: LoginThrottleRecord | null | undefined,
  now: Date
) {
  if (!record?.firstFailureAt) {
    return true;
  }

  if (now.getTime() - record.firstFailureAt.getTime() >= THROTTLE_WINDOW_MS) {
    return true;
  }

  if (record.blockedUntil && record.blockedUntil.getTime() <= now.getTime()) {
    return true;
  }

  return false;
}

export function getNextFailureState(
  record: LoginThrottleRecord | null | undefined,
  limit: number,
  now = new Date()
) {
  if (shouldResetThrottleRecord(record, now)) {
    return {
      failureCount: 1,
      firstFailureAt: now,
      lastAttemptAt: now,
      blockedUntil: null as Date | null,
    };
  }

  const failureCount = record!.failureCount + 1;
  const blockedUntil =
    failureCount >= limit
      ? new Date(now.getTime() + BLOCK_DURATION_MS)
      : null;

  return {
    failureCount,
    firstFailureAt: record!.firstFailureAt,
    lastAttemptAt: now,
    blockedUntil,
  };
}

export async function assertLoginAllowed(
  prisma: PrismaClient,
  args: { credential: string; ip: string }
) {
  const now = new Date();
  const targets = buildThrottleTargets(args);
  const records = await prisma.authThrottle.findMany({
    where: {
      OR: targets.map((target) => ({
        scope: target.scope,
        throttleKey: target.throttleKey,
      })),
    },
    select: {
      scope: true,
      throttleKey: true,
      failureCount: true,
      firstFailureAt: true,
      lastAttemptAt: true,
      blockedUntil: true,
    },
  });

  const blockedRecords = records.filter((record) => isThrottleBlocked(record, now));
  if (blockedRecords.length === 0) {
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    ...blockedRecords.map((record) => getRetryAfterSeconds(record.blockedUntil, now))
  );

  return {
    allowed: false as const,
    retryAfterSeconds,
  };
}

export async function recordLoginFailure(
  prisma: PrismaClient,
  args: { credential: string; ip: string; userId?: string | null }
) {
  const now = new Date();
  const targets = buildThrottleTargets(args);

  const results = await prisma.$transaction(async (tx) => {
    const nextStates: Array<{ blockedUntil: Date | null }> = [];

    for (const target of targets) {
      const existing = await tx.authThrottle.findUnique({
        where: {
          scope_throttleKey: {
            scope: target.scope,
            throttleKey: target.throttleKey,
          },
        },
        select: {
          scope: true,
          throttleKey: true,
          failureCount: true,
          firstFailureAt: true,
          lastAttemptAt: true,
          blockedUntil: true,
        },
      });

      const nextState = getNextFailureState(existing, target.limit, now);
      nextStates.push({ blockedUntil: nextState.blockedUntil });

      await tx.authThrottle.upsert({
        where: {
          scope_throttleKey: {
            scope: target.scope,
            throttleKey: target.throttleKey,
          },
        },
        update: {
          failureCount: nextState.failureCount,
          firstFailureAt: nextState.firstFailureAt,
          lastAttemptAt: nextState.lastAttemptAt,
          blockedUntil: nextState.blockedUntil,
          userId: args.userId ?? null,
        },
        create: {
          scope: target.scope,
          throttleKey: target.throttleKey,
          failureCount: nextState.failureCount,
          firstFailureAt: nextState.firstFailureAt,
          lastAttemptAt: nextState.lastAttemptAt,
          blockedUntil: nextState.blockedUntil,
          userId: args.userId ?? null,
        },
      });
    }

    return nextStates;
  });

  const retryAfterSeconds = Math.max(
    ...results.map((record) => getRetryAfterSeconds(record.blockedUntil, now)),
    0
  );

  return {
    retryAfterSeconds,
  };
}

export async function clearLoginFailures(
  prisma: PrismaClient,
  args: { credential: string; ip: string }
) {
  const targets = buildThrottleTargets(args);
  await prisma.authThrottle.deleteMany({
    where: {
      OR: targets.map((target) => ({
        scope: target.scope,
        throttleKey: target.throttleKey,
      })),
    },
  });
}
