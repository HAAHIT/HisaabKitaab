import { describe, it, expect } from "vitest";
import { generateRandomPassword } from "./utils";

describe("generateRandomPassword", () => {
  it("generates a password of the specified length", () => {
    const pwd1 = generateRandomPassword(8);
    expect(pwd1.length).toBe(8);

    const pwd2 = generateRandomPassword(16);
    expect(pwd2.length).toBe(16);
  });

  it("generates different passwords on subsequent calls", () => {
    const pwd1 = generateRandomPassword(16);
    const pwd2 = generateRandomPassword(16);
    expect(pwd1).not.toBe(pwd2);
  });
});
