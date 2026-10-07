import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totp, type TestUser } from "../support/fixtures";

/**
 * Each browser context gets its own client IP (x-forwarded-for) so the per-IP
 * rate limits of one test do not affect the next. This only works locally:
 * on Vercel the platform overwrites x-forwarded-for.
 */
export async function newContext(browser: Browser): Promise<BrowserContext> {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip }, acceptDownloads: true });
}

function rand(): number {
  return Math.floor(Math.random() * 250) + 1;
}

export async function signIn(page: Page, user: Pick<TestUser, "email" | "password">, locale = "en"): Promise<void> {
  await page.goto(`/${locale}/sign-in`);
  await page.fill("#field-email", user.email);
  await page.fill("#field-password", user.password);
  await Promise.all([page.waitForURL(/\/(dashboard|admin|mfa|sign-in)/), page.click("button[type=submit]")]);
  await page.waitForLoadState("networkidle");
}

/** A TOTP code can be used once: wait for the next 30-second window. */
export async function nextTotpWindow(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30_500 - (Date.now() % 30_000)));
}

/** A fresh code that is not about to expire. */
export async function freshCode(secret: string): Promise<string> {
  if (Date.now() % 30_000 > 25_000) await nextTotpWindow();
  return totp(secret);
}

export type Enrollment = { secret: string; codes: string[] };

/** Completes TOTP enrollment on the /mfa page and returns the secret and recovery codes. */
export async function enrollMfa(page: Page): Promise<Enrollment> {
  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByRole("button", { name: /Generate QR code/ }).click();
  const secret = (await page.locator("code").textContent())?.trim() ?? "";
  await page.fill("#field-code", await freshCode(secret));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  const list = page.getByTestId("recovery-codes");
  await expect(list).toBeVisible();
  const codes = (await list.locator("li").allTextContents()).map((c) => c.trim());
  await page.getByLabel("I have saved my recovery codes in a safe place").check();
  await Promise.all([page.waitForURL(/\/(admin|dashboard)$/), page.getByRole("button", { name: "Continue" }).click()]);
  return { secret, codes };
}

/** Signs in an admin and completes TOTP enrollment (first sign-in). */
export async function signInAdmin(page: Page, user: TestUser): Promise<Enrollment> {
  await signIn(page, user);
  return enrollMfa(page);
}

export const ALERT = "form [role=alert], [role=status]";
