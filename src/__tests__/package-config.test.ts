/**
 * Tests for package.json configuration changes introduced in this PR.
 *
 * This PR:
 * - Renamed the project from "doorcraft-pro" to "hisaabkitaab"
 * - Added `"type": "module"` for ESM compatibility
 * - Added `fast-xml-parser` as a production dependency (required for Tally XML export)
 * - Added the `journal:backfill` npm script
 */
import { describe, it, expect } from "vitest";
import pkg from "../../package.json";

describe("package.json project identity", () => {
  it('is named "hisaabkitaab"', () => {
    expect(pkg.name).toBe("hisaabkitaab");
  });

  it("is not named the legacy doorcraft-pro name", () => {
    expect(pkg.name).not.toBe("doorcraft-pro");
  });
});

describe("package.json ESM module type", () => {
  it('declares "type": "module" for ESM support', () => {
    expect((pkg as Record<string, unknown>).type).toBe("module");
  });
});

describe("package.json dependencies", () => {
  it("lists fast-xml-parser as a production dependency", () => {
    expect(pkg.dependencies).toHaveProperty("fast-xml-parser");
  });

  it("fast-xml-parser version satisfies ^5.5.10", () => {
    const version = pkg.dependencies["fast-xml-parser" as keyof typeof pkg.dependencies];
    expect(version).toBe("^5.5.10");
  });
});

describe("package.json scripts", () => {
  it("includes the journal:backfill script", () => {
    expect(pkg.scripts).toHaveProperty("journal:backfill");
  });

  it("journal:backfill script runs the backfill TypeScript file via tsx", () => {
    expect(pkg.scripts["journal:backfill" as keyof typeof pkg.scripts]).toContain(
      "scripts/backfill-journal.ts"
    );
  });

  it("retains the existing db:seed script", () => {
    expect(pkg.scripts).toHaveProperty("db:seed");
  });

  it("retains the media:migrate script", () => {
    expect(pkg.scripts).toHaveProperty("media:migrate");
  });

  it("uses vitest as the test runner", () => {
    expect(pkg.scripts.test).toContain("vitest");
  });
});