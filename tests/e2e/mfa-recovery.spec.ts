import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "../support/fixtures";
import { enrollMfa, freshCode, newContext, nextTotpWindow, signIn, signInAdmin } from "./helpers";

const users: TestUser[] = [];
test.afterAll(async () => {
  await deleteTestUsers(users);
});

async function factorCount(userId: string): Promise<number> {
  const { data } = await serviceClient().auth.admin.mfa.listFactors({ userId });
  return (data?.factors ?? []).filter((f) => f.status === "verified").length;
}

async function unusedCodes(userId: string): Promise<number> {
  const { count } = await serviceClient().from("mfa_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", userId).is("used_at", null);
  return count ?? 0;
}

test("enrolling shows 10 one-time recovery codes, stored only as hashes", async ({ browser }) => {
  const user = await createTestUser("rc-enroll");
  users.push(user);
  const page = await (await newContext(browser)).newPage();
  await signIn(page, user);
  await page.goto("/en/mfa");
  const { codes } = await enrollMfa(page);

  expect(codes).toHaveLength(10);
  for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  expect(await unusedCodes(user.id)).toBe(10);
  const { data } = await serviceClient().from("mfa_recovery_codes").select("code_hash").eq("user_id", user.id);
  const stored = (data ?? []).map((r) => r.code_hash).join(" ");
  for (const code of codes) expect(stored).not.toContain(code.replace("-", ""));

  await page.goto("/en/dashboard/profile");
  await expect(page.getByText("You have 10 unused recovery codes.")).toBeVisible();
});

test("a recovery code resets two-step verification; wrong and reused codes fail", async ({ browser }) => {
  const user = await createTestUser("rc-use");
  users.push(user);
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await signIn(page, user);
  await page.goto("/en/mfa");
  const { codes } = await enrollMfa(page);

  // Second session that should be cut by the reset.
  const other = await (await newContext(browser)).newPage();
  await signIn(other, user);
  await expect(other).toHaveURL(/\/en\/mfa$/);

  await page.context().clearCookies();
  await signIn(page, user);
  await expect(page).toHaveURL(/\/en\/mfa$/);
  await page.getByRole("button", { name: /Use a recovery code/ }).click();
  await page.fill("#field-recoveryCode", "AAAAA-BBBBB");
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page.locator("form [role=alert]").first()).toContainText("incorrect or has already been used");

  await page.fill("#field-recoveryCode", codes[3]!.toLowerCase());
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in\?reason=mfa_reset/);
  await expect(page.getByText("Two-step verification was reset with a recovery code")).toBeVisible();

  expect(await factorCount(user.id)).toBe(0);
  expect(await unusedCodes(user.id)).toBe(0);
  await other.goto("/en/dashboard");
  await expect(other).toHaveURL(/\/en\/sign-in/);

  // Regular users without MFA go straight to the dashboard afterwards.
  await signIn(page, user);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  const { data: audit } = await serviceClient().from("audit_logs").select("action").eq("target_id", user.id).like("action", "auth.mfa.recovery_%");
  expect((audit ?? []).map((a) => a.action).sort()).toEqual(["auth.mfa.recovery_failed", "auth.mfa.recovery_used"]);
});

test("an administrator who uses a recovery code must enroll a new authenticator", async ({ browser }) => {
  const admin = await createTestUser("rc-admin", { role: "admin" });
  users.push(admin);
  const page = await (await newContext(browser)).newPage();
  const { codes } = await signInAdmin(page, admin);
  await expect(page).toHaveURL(/\/en\/admin$/);

  await page.context().clearCookies();
  await signIn(page, admin);
  await page.getByRole("button", { name: /Use a recovery code/ }).click();
  await page.fill("#field-recoveryCode", codes[0]!);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in\?reason=mfa_reset/);

  await signIn(page, admin);
  await expect(page).toHaveURL(/\/en\/mfa$/);
  await expect(page.getByRole("button", { name: /Generate QR code/ })).toBeVisible();
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/mfa$/);
});

test("recovery codes can be regenerated with a current TOTP code", async ({ browser }) => {
  const user = await createTestUser("rc-regen");
  users.push(user);
  const page = await (await newContext(browser)).newPage();
  await signIn(page, user);
  await page.goto("/en/mfa");
  const { secret, codes: first } = await enrollMfa(page);

  await page.goto("/en/dashboard/profile");
  await page.fill("#field-regenerate-code", "000000");
  await page.getByRole("button", { name: "Generate new codes" }).click();
  await expect(page.getByText("The code is incorrect or has expired.")).toBeVisible();

  await nextTotpWindow();
  await page.fill("#field-regenerate-code", await freshCode(secret));
  await page.getByRole("button", { name: "Generate new codes" }).click();
  const list = page.getByTestId("recovery-codes");
  await expect(list).toBeVisible();
  const second = (await list.locator("li").allTextContents()).map((c) => c.trim());
  expect(second).toHaveLength(10);
  expect(second.some((c) => first.includes(c))).toBe(false);
  expect(await unusedCodes(user.id)).toBe(10);
});
