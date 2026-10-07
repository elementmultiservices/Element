import { expect, test, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { createStoredFile, createTestUser, deleteTestUsers, PDF_BYTES, serviceClient, type TestUser } from "../support/fixtures";
import { ALERT, newContext, signIn } from "./helpers";

let owner: TestUser;
let other: TestUser;
let ownerFile: { id: string; storagePath: string };

test.beforeAll(async () => {
  [owner, other] = await Promise.all([createTestUser("files-owner"), createTestUser("files-other")]);
  ownerFile = await createStoredFile(owner, "Owner contract.pdf");
});

test.afterAll(async () => {
  await deleteTestUsers([owner, other]);
});

/** Runs the real upload flow from the page, bypassing every client-side check. */
async function rawUpload(page: Page, input: { name: string; mime: string; declaredSize: number; body: Buffer }) {
  return page.evaluate(async ({ name, mime, declaredSize, body }) => {
    const intentRes = await fetch("/api/files/upload-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, size: declaredSize, mime }),
    });
    const intent = await intentRes.json();
    if (!intentRes.ok) return { stage: "intent", status: intentRes.status, error: intent.error as string };
    await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: new Uint8Array(body) });
    const confirmRes = await fetch("/api/files/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId: intent.intentId }),
    });
    return { stage: "confirm", status: confirmRes.status, error: (await confirmRes.json()).error as string | undefined };
  }, { ...input, body: [...input.body] as unknown as Buffer });
}

test("a user cannot see or download someone else's files", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, other);
  await page.goto("/en/dashboard");
  await expect(page.locator("main")).not.toContainText("Owner contract.pdf");

  const res = await page.request.get(`/api/files/${ownerFile.id}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(404);

  // Guessing the storage path does not help: objects are private.
  const direct = await page.request.get(`http://127.0.0.1:54421/storage/v1/object/files/${ownerFile.storagePath}`);
  expect(direct.status()).toBeGreaterThanOrEqual(400);
});

test("the owner downloads through a short-lived signed URL", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, owner);
  const res = await page.request.get(`/api/files/${ownerFile.id}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const location = res.headers()["location"] ?? "";
  const token = new URL(location).searchParams.get("token") ?? "";
  const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp: number };
  expect(payload.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
  const file = await page.request.get(location);
  expect(file.headers()["content-disposition"]).toMatch(/^attachment/);
});

test("trashed files are inaccessible to users", async ({ browser }) => {
  const trashed = await createStoredFile(owner, "Trashed report.pdf");
  await serviceClient().from("files").update({ deleted_at: new Date().toISOString(), deleted_by: owner.id }).eq("id", trashed.id);

  const page = await (await newContext(browser)).newPage();
  await signIn(page, owner);
  await page.goto("/en/dashboard");
  await expect(page.locator("main")).toContainText("Owner contract.pdf");
  await expect(page.locator("main")).not.toContainText("Trashed report.pdf");
  const res = await page.request.get(`/api/files/${trashed.id}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("disallowed file types are rejected", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, owner);

  // Browser-side feedback
  await page.goto("/en/dashboard/upload");
  for (const [name, mimeType] of [
    ["tool.exe", "application/octet-stream"],
    ["page.html", "text/html"],
    ["invoice.exe.pdf", "application/pdf"],
  ] as const) {
    await page.setInputFiles("input[type=file]", { name, mimeType, buffer: PDF_BYTES });
    await expect(page.locator(ALERT).first()).toContainText(/not allowed|more than one extension/);
  }

  // Server-side enforcement (client checks bypassed)
  expect((await rawUpload(page, { name: "tool.exe", mime: "application/octet-stream", declaredSize: 10, body: PDF_BYTES })).error).toBe("type_not_allowed");
  expect((await rawUpload(page, { name: "evil.exe.pdf", mime: "application/pdf", declaredSize: PDF_BYTES.length, body: PDF_BYTES })).error).toBe("double_extension");
  expect((await rawUpload(page, { name: "x.pdf", mime: "image/png", declaredSize: PDF_BYTES.length, body: PDF_BYTES })).error).toBe("type_not_allowed");

  // Content that does not match the declared type, and Office macros
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  expect((await rawUpload(page, { name: "fake.pdf", mime: "application/pdf", declaredSize: png.length, body: png })).error).toBe("content_rejected");
  const docm = Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      "word/vbaProject.bin": new Uint8Array([1, 2, 3]),
    }),
  );
  expect(
    (await rawUpload(page, { name: "macro.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", declaredSize: docm.length, body: docm }))
      .error,
  ).toBe("content_rejected");

  const { count } = await serviceClient().from("files").select("id", { count: "exact", head: true }).eq("owner_id", owner.id).is("deleted_at", null);
  expect(count).toBe(1); // only the fixture file
});

test("oversized files are rejected", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, owner);
  await page.goto("/en/dashboard/upload");
  const big = Buffer.concat([PDF_BYTES, Buffer.alloc(10 * 1024 * 1024)]);
  await page.setInputFiles("input[type=file]", { name: "big.pdf", mimeType: "application/pdf", buffer: big });
  await expect(page.locator(ALERT).first()).toContainText("maximum size of 10 MB");

  // Declared size over the limit is refused before any upload URL is issued...
  expect((await rawUpload(page, { name: "huge.pdf", mime: "application/pdf", declaredSize: 11 * 1024 * 1024, body: PDF_BYTES })).error).toBe("too_large");
  // ...and lying about the size is caught when the object is verified.
  expect((await rawUpload(page, { name: "liar.pdf", mime: "application/pdf", declaredSize: 5, body: PDF_BYTES })).error).toBe("size_mismatch");
});

test("a valid upload goes through and is listed", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, other);
  await page.goto("/en/dashboard/upload");
  await page.setInputFiles("input[type=file]", { name: "Valid statement.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await page.getByRole("button", { name: "Upload file" }).last().click();
  await expect(page.locator(ALERT).first()).toContainText("uploaded and verified");
  await page.goto("/en/dashboard");
  await expect(page.locator("tbody")).toContainText("Valid statement.pdf");
});
