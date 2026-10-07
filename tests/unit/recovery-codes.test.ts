import { describe, expect, it } from "vitest";
import { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode } from "@/lib/auth/recovery-code-format";

describe("recovery codes", () => {
  it("generates unambiguous XXXXX-XXXXX codes", () => {
    const codes = new Set(Array.from({ length: 500 }, generateRecoveryCode));
    expect(codes.size).toBe(500);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("normalizes user input", () => {
    expect(normalizeRecoveryCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(normalizeRecoveryCode("ABCDE FGHJK")).toBe("ABCDEFGHJK");
    expect(normalizeRecoveryCode("ABCDE-FGHJ")).toBeNull();
    expect(normalizeRecoveryCode("ABCDE-FGHJ0")).toBeNull();
    expect(normalizeRecoveryCode("'; drop table--")).toBeNull();
  });

  it("hashes with a secret and binds the hash to the user", () => {
    const a = hashRecoveryCode("secret-1", "user-a", "ABCDEFGHJK");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRecoveryCode("secret-1", "user-b", "ABCDEFGHJK")).not.toBe(a);
    expect(hashRecoveryCode("secret-2", "user-a", "ABCDEFGHJK")).not.toBe(a);
    expect(hashRecoveryCode("secret-1", "user-a", "ABCDEFGHJK")).toBe(a);
  });
});
