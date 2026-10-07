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

/** Signs in an admin and completes TOTP enrollment (first sign-in). */
export async function signInAdmin(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user);
  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByRole("button", { name: /Generate QR code/ }).click();
  const secret = (await page.locator("code").textContent())?.trim() ?? "";
  await page.fill("#field-code", totp(secret));
  await Promise.all([page.waitForURL(/\/admin$/), page.click("button[type=submit]")]);
}

export const ALERT = "form [role=alert], [role=status]";
