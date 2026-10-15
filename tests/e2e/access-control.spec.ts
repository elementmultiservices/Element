import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "../support/fixtures";
import { newContext, signIn } from "./helpers";

const users: TestUser[] = [];
let regular: TestUser;
let inactive: TestUser;

test.beforeAll(async () => {
  regular = await createTestUser("ac-user");
  inactive = await createTestUser("ac-inactive", { isActive: false });
  users.push(regular, inactive);
});

test.afterAll(async () => {
  await deleteTestUsers(users);
});

const ADMIN_PAGES = ["/en/admin", "/en/admin/users", "/en/admin/files", "/en/admin/trash", "/en/admin/audit", "/en/admin/newsletter", "/en/admin/messages", "/es/admin/categories"];

test("anonymous visitors are sent to sign-in from private areas", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  for (const path of [...ADMIN_PAGES, "/en/dashboard", "/es/dashboard/profile"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/(en|es)\/sign-in/);
  }
  for (const api of ["/api/admin/export/users", "/api/files/00000000-0000-0000-0000-000000000000/download"]) {
    const res = await page.request.get(api, { maxRedirects: 0 });
    expect(res.status(), api).toBe(401);
  }
});

test("admin routes reject regular users", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, regular);
  await expect(page).toHaveURL(/\/en\/dashboard$/);

  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/(en|es)\/dashboard$/);
  }
  for (const kind of ["users", "files", "audit"]) {
    const res = await page.request.get(`/api/admin/export/${kind}`);
    expect(res.status(), kind).toBe(403);
  }
  // Uploading on behalf of another account is an admin-only capability.
  const intent = await page.request.post("/api/files/upload-intent", {
    headers: { Origin: "http://localhost:3100" },
    data: { name: "x.pdf", size: 10, mime: "application/pdf", ownerId: inactive.id },
  });
  expect(intent.status()).toBe(403);
});

test("deactivated accounts cannot sign in", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, inactive);
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await expect(page.locator("form [role=alert]")).toContainText("incorrect, or the account is not available");
});

test("deactivation ends an open session on the next request", async ({ browser }) => {
  const victim = await createTestUser("ac-live");
  users.push(victim);
  const page = await (await newContext(browser)).newPage();
  await signIn(page, victim);
  await expect(page).toHaveURL(/\/en\/dashboard$/);

  const service = serviceClient();
  await service.from("profiles").update({ is_active: false }).eq("id", victim.id);
  await service.rpc("revoke_user_sessions", { p_user: victim.id });

  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/sign-in\?reason=session_ended/);
  const res = await page.request.get("/api/admin/export/users");
  expect(res.status()).toBe(401);
});

test("identical response for wrong password and unknown account", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, { email: regular.email, password: "WrongPassword123" });
  const known = await page.locator("form [role=alert]").textContent();
  await signIn(page, { email: "nobody-e2e@test.local", password: "WrongPassword123" });
  const unknown = await page.locator("form [role=alert]").textContent();
  expect(known).toBeTruthy();
  expect(known).toBe(unknown);
});
