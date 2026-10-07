import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { serviceClient } from "../support/fixtures";
import { newContext } from "./helpers";

function sessionSecret(): string {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("SESSION_SECRET="));
  return line?.slice("SESSION_SECRET=".length) ?? "";
}

async function fillForm(page: Page, email: string) {
  await page.fill("#field-name", "Contact Tester");
  await page.fill("#field-email", email);
  await page.fill("#field-subject", "Question about the service");
  await page.fill("#field-message", "I would like more information about Element.");
  await page.check("#field-consent");
}

async function stored(email: string) {
  const { data } = await serviceClient().from("contact_messages").select("id").eq("email", email);
  return data ?? [];
}

async function acknowledgement(messageId: string): Promise<unknown> {
  const { data } = await serviceClient().from("audit_logs").select("metadata").eq("action", "contact.received").eq("target_id", messageId).single();
  return (data?.metadata as { acknowledgement?: string } | null)?.acknowledgement;
}

test.afterAll(async () => {
  await serviceClient().from("contact_messages").delete().like("email", "e2e-contact-%");
});

test("submissions faster than a human are silently dropped (time trap)", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  const email = `e2e-contact-fast-${randomUUID().slice(0, 6)}@example.com`;
  await page.goto("/en/contact");
  await fillForm(page, email);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
  expect(await stored(email)).toHaveLength(0);
});

test("forged or expired form tokens are refused", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  const email = `e2e-contact-forged-${randomUUID().slice(0, 6)}@example.com`;
  await page.goto("/en/contact");
  await page.waitForTimeout(3500);
  await fillForm(page, email);
  await page.evaluate(() => {
    (document.querySelector('input[name="formToken"]') as HTMLInputElement).value = "forged.token.value";
  });
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
  expect(await stored(email)).toHaveLength(0);

  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("form:contact")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3 * 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(new TextEncoder().encode(sessionSecret()));
  await page.goto("/en/contact");
  await page.waitForTimeout(3500);
  await fillForm(page, email);
  await page.evaluate((token) => {
    (document.querySelector('input[name="formToken"]') as HTMLInputElement).value = token;
  }, expired);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("The form expired. Reload the page and try again.")).toBeVisible();
  expect(await stored(email)).toHaveLength(0);
});

test("the sender gets at most one acknowledgement per day", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  const email = `e2e-contact-ack-${randomUUID().slice(0, 6)}@example.com`;

  for (let i = 0; i < 2; i++) {
    await page.goto("/en/contact");
    await page.waitForTimeout(3500);
    await fillForm(page, email);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Message sent")).toBeVisible();
  }

  const rows = await stored(email);
  expect(rows).toHaveLength(2);
  const acks = await Promise.all(rows.map((r) => acknowledgement(r.id)));
  expect(acks.sort()).toEqual(["sent", "skipped"]);
});
