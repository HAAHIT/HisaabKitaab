/**
 * Tests for public/manifest.json
 *
 * Verifies the PWA web app manifest added in this PR conforms to the
 * Web App Manifest spec and contains the fields required for installability.
 */
import { describe, it, expect } from "vitest";
import manifest from "../../public/manifest.json";

describe("PWA Web App Manifest", () => {
  describe("required identity fields", () => {
    it("has the correct application name", () => {
      expect(manifest.name).toBe("HisaabKitaab — Digital Khata");
    });

    it("has a short_name for home screen display", () => {
      expect(manifest.short_name).toBe("HisaabKitaab");
    });

    it("has a description", () => {
      expect(manifest.description).toBeTruthy();
      expect(typeof manifest.description).toBe("string");
    });
  });

  describe("required launch fields", () => {
    it("has a start_url pointing to the dashboard", () => {
      expect(manifest.start_url).toBe("/dashboard");
    });

    it("has display set to standalone for app-like experience", () => {
      expect(manifest.display).toBe("standalone");
    });
  });

  describe("visual fields", () => {
    it("has a valid hex background_color", () => {
      expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("has a valid hex theme_color", () => {
      expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("uses the dark navy background color", () => {
      expect(manifest.background_color.toUpperCase()).toBe("#0F172A");
    });

    it("uses the indigo theme color", () => {
      expect(manifest.theme_color.toUpperCase()).toBe("#6366F1");
    });
  });

  describe("icons", () => {
    it("provides at least two icon sizes", () => {
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });

    it("includes a 192x192 icon", () => {
      const icon192 = manifest.icons.find((icon) => icon.sizes === "192x192");
      expect(icon192).toBeDefined();
    });

    it("includes a 512x512 icon", () => {
      const icon512 = manifest.icons.find((icon) => icon.sizes === "512x512");
      expect(icon512).toBeDefined();
    });

    it("192x192 icon is a PNG at the correct path", () => {
      const icon192 = manifest.icons.find((icon) => icon.sizes === "192x192");
      expect(icon192?.src).toBe("/icons/icon-192.png");
      expect(icon192?.type).toBe("image/png");
    });

    it("512x512 icon is a PNG at the correct path", () => {
      const icon512 = manifest.icons.find((icon) => icon.sizes === "512x512");
      expect(icon512?.src).toBe("/icons/icon-512.png");
      expect(icon512?.type).toBe("image/png");
    });

    it("all icons declare a purpose", () => {
      for (const icon of manifest.icons) {
        expect(icon.purpose).toBeTruthy();
      }
    });

    it("icons support both any and maskable purposes for broad device support", () => {
      for (const icon of manifest.icons) {
        // purpose field should contain both "any" and "maskable"
        expect(icon.purpose).toContain("any");
        expect(icon.purpose).toContain("maskable");
      }
    });
  });

  describe("locale and orientation", () => {
    it("sets lang to hi (Hindi) for the target market", () => {
      expect(manifest.lang).toBe("hi");
    });

    it("sets text direction to ltr", () => {
      expect(manifest.dir).toBe("ltr");
    });

    it("sets orientation to portrait", () => {
      expect(manifest.orientation).toBe("portrait");
    });
  });

  describe("categories", () => {
    it("declares business and finance categories", () => {
      expect(manifest.categories).toContain("business");
      expect(manifest.categories).toContain("finance");
    });
  });
});