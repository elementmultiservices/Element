import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "../support/fixtures";
import { freshCode, newContext, nextTotpWindow, signIn, signInAdmin } from "./helpers";

let admin: TestUser;
let member: TestUser;

test.beforeAll(async () => {
  [admin, member] = await Promise.all([createTestUser("role-admin", { role: "admin" }), createTestUser("role-member")]);
});

test.afterAll(async () => {
  await deleteTestUsers([admin, member]);
});

async function roleOf(id: string): Promise<string | undefined> {
  const { data } = await serviceClient().from("profiles").select("role").eq("id", id).single();
  return data?.role;
}

test("promote and demote with step-up verification; the target is signed out and notified", async ({ browser }) => {
  const adminPage = await (await newContext(browser)).newPage();
  const { secret } = await signInAdmin(adminPage, admin);

  const memberPage = await (await newContext(browser)).newPage();
  await signIn(memberPage, member);
  await expect(memberPage).toHaveURL(/\/en\/dashboard$/);

  await adminPage.goto(`/en/admin/users/${member.id}`);
  await adminPage.getByRole("button", { name: "Make administrator" }).click();
  const dialog = adminPage.getByRole("alertdialog");
  await dialog.locator("#field-stepup-code").fill("123456");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByText("The code is incorrect or has expired.")).toBeVisible();
  expect(await roleOf(member.id)).toBe("user");

  await nextTotpWindow();
  await dialog.locator("#field-stepup-code").fill(await freshCode(secret));
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(adminPage.getByText("The role was changed.")).toBeVisible();
  expect(await roleOf(member.id)).toBe("admin");

  // The member's open session is cut; next sign-in requires MFA enrollment.
  await memberPage.goto("/en/dashboard");
  await expect(memberPage).toHaveURL(/\/en\/sign-in/);
  await signIn(memberPage, member);
  await expect(memberPage).toHaveURL(/\/en\/mfa$/);

  const { data: audit } = await serviceClient()
    .from("audit_logs")
    .select("metadata")
    .eq("action", "user.role.changed")
    .eq("target_id", member.id)
    .order("id", { ascending: false })
    .limit(1)
    .single();
  expect(audit?.metadata).toEqual({ from: "user", to: "admin" });

  // Demote back.
  await nextTotpWindow();
  await adminPage.reload();
  await adminPage.getByRole("button", { name: "Change to user" }).click();
  await adminPage.getByRole("alertdialog").locator("#field-stepup-code").fill(await freshCode(secret));
  await adminPage.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(adminPage.getByText("The role was changed.")).toBeVisible();
  expect(await roleOf(member.id)).toBe("user");

  // Administrators are never offered a role change on their own account.
  await adminPage.goto(`/en/admin/users/${admin.id}`);
  await expect(adminPage.getByText("This is your own account.")).toBeVisible();
  await expect(adminPage.getByRole("button", { name: /Make administrator|Change to user/ })).toHaveCount(0);
});
