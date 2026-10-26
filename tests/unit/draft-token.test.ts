import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ SESSION_SECRET: "test-secret-for-draft-tokens-0123456789abcdef" }) }));

const { checkDraftToken, checkFormToken, issueDraftToken, issueFormToken } = await import("@/lib/security/form-token");

describe("public intake draft token", () => {
  it("carries a draft id and acts as a one-minute time trap", async () => {
    const token = await issueDraftToken();
    const now = Date.now();
    const early = await checkDraftToken(token, now + 10_000);
    expect(early.status).toBe("tooFast");
    expect(early.draftId).toMatch(/^[0-9a-f-]{36}$/);
    const later = await checkDraftToken(token, now + 120_000);
    expect(later).toEqual({ status: "ok", draftId: early.draftId });
  });

  it("gives every page view its own draft", async () => {
    const [a, b] = await Promise.all([issueDraftToken(), issueDraftToken()]);
    const at = Date.now() + 120_000;
    expect((await checkDraftToken(a, at)).draftId).not.toBe((await checkDraftToken(b, at)).draftId);
  });

  it("expires after a day", async () => {
    const token = await issueDraftToken();
    expect(await checkDraftToken(token, Date.now() + 25 * 60 * 60 * 1000)).toEqual({ status: "expired", draftId: null });
  });

  it("rejects tampered tokens and tokens for other forms", async () => {
    const token = await issueDraftToken();
    expect((await checkDraftToken(`${token}x`)).status).toBe("invalid");
    expect((await checkDraftToken(null)).status).toBe("invalid");
    expect((await checkDraftToken(await issueFormToken("contact"))).status).toBe("invalid");
    expect(await checkFormToken(token, "intake-draft")).toBe("invalid");
  });
});
