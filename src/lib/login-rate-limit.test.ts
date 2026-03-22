import { describe, expect, it } from "vitest";
import {
  getNextFailureState,
  getRetryAfterSeconds,
  isThrottleBlocked,
} from "./login-rate-limit";

describe("login rate limit helpers", () => {
  it("starts a new failure window on the first failed attempt", () => {
    const now = new Date("2026-03-23T00:00:00.000Z");
    const next = getNextFailureState(null, 5, now);

    expect(next).toMatchObject({
      failureCount: 1,
      firstFailureAt: now,
      lastAttemptAt: now,
      blockedUntil: null,
    });
  });

  it("blocks once the threshold is reached inside the active window", () => {
    const now = new Date("2026-03-23T00:05:00.000Z");
    const next = getNextFailureState(
      {
        scope: "CREDENTIAL",
        throttleKey: "key",
        failureCount: 4,
        firstFailureAt: new Date("2026-03-23T00:00:00.000Z"),
        lastAttemptAt: new Date("2026-03-23T00:04:00.000Z"),
        blockedUntil: null,
      },
      5,
      now
    );

    expect(next.failureCount).toBe(5);
    expect(next.blockedUntil).not.toBeNull();
    expect(isThrottleBlocked(next, now)).toBe(true);
    expect(getRetryAfterSeconds(next.blockedUntil, now)).toBeGreaterThan(0);
  });

  it("resets once the throttle window has expired", () => {
    const now = new Date("2026-03-23T00:20:01.000Z");
    const next = getNextFailureState(
      {
        scope: "IP",
        throttleKey: "key",
        failureCount: 9,
        firstFailureAt: new Date("2026-03-23T00:00:00.000Z"),
        lastAttemptAt: new Date("2026-03-23T00:04:00.000Z"),
        blockedUntil: null,
      },
      10,
      now
    );

    expect(next).toMatchObject({
      failureCount: 1,
      firstFailureAt: now,
      lastAttemptAt: now,
      blockedUntil: null,
    });
  });

  it("stops reporting blocked status once blockedUntil has passed", () => {
    const now = new Date("2026-03-23T00:16:00.000Z");
    expect(
      isThrottleBlocked(
        {
          blockedUntil: new Date("2026-03-23T00:15:00.000Z"),
        },
        now
      )
    ).toBe(false);
    expect(getRetryAfterSeconds(new Date("2026-03-23T00:15:00.000Z"), now)).toBe(0);
  });
});
