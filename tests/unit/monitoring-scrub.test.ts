import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { redact, scrubBreadcrumb, scrubEvent, stripUrl } from "@/lib/monitoring/scrub";

describe("redact", () => {
  it("removes emails, file names, tokens, JWTs and IPs", () => {
    const input =
      "Failed for ana@example.com uploading Contrato firmado.pdf and informe.xlsx from 10.0.0.1 token_hash=abc123 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlX3ZhbHVl";
    const out = redact(input);
    expect(out).not.toContain("ana@example.com");
    expect(out).not.toContain("firmado.pdf");
    expect(out).not.toContain("informe.xlsx");
    expect(out).not.toContain("10.0.0.1");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("eyJhbGci");
    expect(out).toContain("[email]");
    expect(out).toContain("[file]");
  });

  it("strips query strings from URLs", () => {
    expect(stripUrl("https://app.example/es/auth/confirm?token_hash=secret&type=recovery")).toBe("https://app.example/es/auth/confirm");
  });
});

describe("scrubEvent", () => {
  it("drops user, request headers/cookies/body and extra data", () => {
    const event = {
      type: undefined,
      message: "Upload of nomina.docx failed for juan@example.com",
      user: { id: "u1", email: "juan@example.com", ip_address: "1.2.3.4" },
      extra: { originalName: "secreto.pdf" },
      request: {
        method: "POST",
        url: "https://app.example/api/files/confirm?x=1",
        headers: { cookie: "sb-auth=...", authorization: "Bearer x" },
        cookies: { sb: "x" },
        data: { name: "secreto.pdf" },
        query_string: "x=1",
      },
      exception: { values: [{ type: "Error", value: "Cannot read secreto.pdf", stacktrace: { frames: [{ filename: "a.js", vars: { pw: "x" } }] } }] },
      contexts: { custom: { email: "a@b.co" }, os: { name: "Windows" } },
      breadcrumbs: [
        { category: "console", message: "a@b.co" },
        { category: "fetch", data: { url: "/api/x?token=abc", method: "GET", status_code: 200, body: "secret" } },
      ],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ method: "POST", url: "https://app.example/api/files/confirm" });
    expect(out.message).toBe("Upload of [file] failed for [email]");
    expect(out.exception?.values?.[0]?.value).toBe("Cannot read [file]");
    expect(out.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
    expect(JSON.stringify(out.contexts)).not.toContain("a@b.co");
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs?.[0]?.data).toEqual({ url: "/api/x", method: "GET", status_code: 200 });
  });

  it("drops console and UI breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.input", message: "x" })).toBeNull();
  });
});
