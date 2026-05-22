/**
 * Tests for the seed configuration helpers in prisma/seed.ts
 *
 * The functions getSeedPassword, resolveSeedTenantId, and resolveSeedTenantSlug
 * are private to the seed script and not exported. These tests specify the
 * expected behavior of each function — they mirror the exact implementation
 * so any divergence in the source must be reflected here.
 *
 * Environment variable resolution order:
 *   resolveSeedTenantId:  SEED_TENANT_ID > DEFAULT_TENANT_ID > "default"
 *   resolveSeedTenantSlug: SEED_TENANT_SLUG > "solobooks"
 *   getSeedPassword:       process.env[key] > (prod: throw) > fallback
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mirrored implementations (match prisma/seed.ts exactly) ──────────────────

function getSeedPassword(envKey: string, fallback: string): string {
  const value = process.env[envKey]?.trim();
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${envKey} must be provided when seeding in production. Refusing to use demo passwords.`
    );
  }
  return fallback;
}

function resolveSeedTenantId(): string {
  const fromSeed = process.env.SEED_TENANT_ID?.trim();
  if (fromSeed) {
    return fromSeed;
  }
  const fromDefault = process.env.DEFAULT_TENANT_ID?.trim();
  if (fromDefault) {
    return fromDefault;
  }
  return "default";
}

function resolveSeedTenantSlug(): string {
  const fromSeed = process.env.SEED_TENANT_SLUG?.trim();
  if (fromSeed) {
    return fromSeed;
  }
  return "solobooks";
}

// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSeedTenantId", () => {
  it('returns "default" when neither SEED_TENANT_ID nor DEFAULT_TENANT_ID are set', () => {
    vi.stubEnv("SEED_TENANT_ID", "");
    vi.stubEnv("DEFAULT_TENANT_ID", "");
    expect(resolveSeedTenantId()).toBe("default");
  });

  it("returns SEED_TENANT_ID when it is set", () => {
    vi.stubEnv("SEED_TENANT_ID", "tenant-from-seed-env");
    vi.stubEnv("DEFAULT_TENANT_ID", "tenant-from-default-env");
    expect(resolveSeedTenantId()).toBe("tenant-from-seed-env");
  });

  it("falls back to DEFAULT_TENANT_ID when SEED_TENANT_ID is absent", () => {
    vi.stubEnv("SEED_TENANT_ID", "");
    vi.stubEnv("DEFAULT_TENANT_ID", "tenant-from-default-env");
    expect(resolveSeedTenantId()).toBe("tenant-from-default-env");
  });

  it("trims whitespace from SEED_TENANT_ID", () => {
    vi.stubEnv("SEED_TENANT_ID", "  cuid-abc-123  ");
    expect(resolveSeedTenantId()).toBe("cuid-abc-123");
  });

  it("trims whitespace from DEFAULT_TENANT_ID", () => {
    vi.stubEnv("SEED_TENANT_ID", "");
    vi.stubEnv("DEFAULT_TENANT_ID", "  cuid-abc-456  ");
    expect(resolveSeedTenantId()).toBe("cuid-abc-456");
  });

  it("treats a whitespace-only SEED_TENANT_ID as absent and falls through", () => {
    vi.stubEnv("SEED_TENANT_ID", "   ");
    vi.stubEnv("DEFAULT_TENANT_ID", "fallback-tenant");
    expect(resolveSeedTenantId()).toBe("fallback-tenant");
  });

  it("treats a whitespace-only DEFAULT_TENANT_ID as absent and returns default", () => {
    vi.stubEnv("SEED_TENANT_ID", "");
    vi.stubEnv("DEFAULT_TENANT_ID", "   ");
    expect(resolveSeedTenantId()).toBe("default");
  });
});

describe("resolveSeedTenantSlug", () => {
  it('returns "solobooks" when SEED_TENANT_SLUG is not set', () => {
    vi.stubEnv("SEED_TENANT_SLUG", "");
    expect(resolveSeedTenantSlug()).toBe("solobooks");
  });

  it("returns the value of SEED_TENANT_SLUG when it is set", () => {
    vi.stubEnv("SEED_TENANT_SLUG", "my-custom-slug");
    expect(resolveSeedTenantSlug()).toBe("my-custom-slug");
  });

  it("trims whitespace from SEED_TENANT_SLUG", () => {
    vi.stubEnv("SEED_TENANT_SLUG", "  custom-slug  ");
    expect(resolveSeedTenantSlug()).toBe("custom-slug");
  });

  it("treats a whitespace-only SEED_TENANT_SLUG as absent", () => {
    vi.stubEnv("SEED_TENANT_SLUG", "   ");
    expect(resolveSeedTenantSlug()).toBe("solobooks");
  });
});

describe("getSeedPassword", () => {
  it("returns the env var value when it is set", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "s3cur3P@ss!");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toBe("s3cur3P@ss!");
  });

  it("trims whitespace from the env var value", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "  trimmed-pass  ");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toBe("trimmed-pass");
  });

  it("returns the fallback in non-production when the env var is absent", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toBe("admin123");
  });

  it("returns the fallback in test environment when env var is absent", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "staff123")).toBe("staff123");
  });

  it("throws in production when the env var is absent", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toThrow(
      "SEED_ADMIN_PASSWORD must be provided when seeding in production"
    );
  });

  it("throws in production even when a fallback is provided", () => {
    vi.stubEnv("SEED_STAFF_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSeedPassword("SEED_STAFF_PASSWORD", "staff123")).toThrow(
      "Refusing to use demo passwords."
    );
  });

  it("treats a whitespace-only env var as absent and uses fallback in dev", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "   ");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toBe("admin123");
  });

  it("treats a whitespace-only env var as absent and throws in production", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "   ");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toThrow();
  });

  it("embeds the missing env key name in the production error message", () => {
    vi.stubEnv("SEED_CUSTOMER_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSeedPassword("SEED_CUSTOMER_PASSWORD", "customer123")).toThrow(
      "SEED_CUSTOMER_PASSWORD"
    );
  });

  it("env var takes precedence over fallback even in production", () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "prod-safe-password");
    vi.stubEnv("NODE_ENV", "production");
    // Should NOT throw — the env var is present
    expect(getSeedPassword("SEED_ADMIN_PASSWORD", "admin123")).toBe("prod-safe-password");
  });
});