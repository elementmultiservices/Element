import { expect, test, type Page } from "@playwright/test";
import en from "../../src/messages/en.json";
import { createTestUser, deleteTestUsers, type TestUser } from "../support/fixtures";
import { newContext, signIn, signInAdmin } from "./helpers";

/**
 * Every page renders in both locales with the right `lang` and without missing
 * translations. next-intl renders a missing message as its key path (e.g.
 * "Admin.users.title"), so any "<Namespace>.<key>" text is a failure.
 */
const NAMESPACES = Object.keys(en).join("|");
const RAW_KEY = new RegExp(`\\b(?:${NAMESPACES})\\.[A-Za-z]+(?:\\.[A-Za-z]+)*\\b`);

const PUBLIC_PATHS = ["", "/services", "/location", "/faq", "/about", "/blog", "/contact", "/sign-in", "/reset-password", "/legal/privacy", "/legal/data-policy", "/legal/terms", "/legal/cookies", "/does-not-exist"];
const USER_PATHS = ["/dashboard", "/dashboard/upload", "/dashboard/profile"];
const ADMIN_PATHS = [
  "/admin",
  "/admin/users",
  "/admin/users/invite",
  "/admin/files",
  "/admin/files/upload",
  "/admin/trash",
  "/admin/categories",
  "/admin/blog",
  "/admin/blog/new",
  "/admin/blog/categories",
  "/admin/messages",
  "/admin/settings",
  "/admin/audit",
  "/admin/profile",
];

let user: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  [user, admin] = await Promise.all([createTestUser("i18n-user"), createTestUser("i18n-admin", { role: "admin" })]);
});

test.afterAll(async () => {
  await deleteTestUsers([user, admin]);
});

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /MISSING_MESSAGE|missing message/i.test(m.text())) problems.push(m.text());
  });
  return problems;
}

async function checkPages(page: Page, paths: string[]) {
  const problems = watchConsole(page);
  for (const locale of ["en", "es"] as const) {
    for (const path of paths) {
      await page.goto(`/${locale}${path}`);
      await expect(page.locator("html"), `${locale}${path}`).toHaveAttribute("lang", locale);
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const title = await page.title();
      expect(RAW_KEY.exec(text)?.[0], `raw key on ${locale}${path}`).toBeUndefined();
      expect(RAW_KEY.exec(title)?.[0], `raw key in <title> on ${locale}${path}`).toBeUndefined();
      expect(title, `${locale}${path}`).toMatch(/Element$/);
    }
  }
  expect(problems).toEqual([]);
}

test("public pages render in English and Spanish", async ({ browser }) => {
  await checkPages(await (await newContext(browser)).newPage(), PUBLIC_PATHS);
});

test("user dashboard renders in English and Spanish", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signIn(page, user);
  await checkPages(page, USER_PATHS);
});

test("admin panel renders in English and Spanish", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await signInAdmin(page, admin);
  await checkPages(page, ADMIN_PATHS);
});

test("Spanish copy uses the formal register", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/es/contact");
  const text = await page.locator("main").innerText();
  expect(text).toMatch(/Envíenos/);
  expect(text).not.toMatch(/\b(envíanos|escríbenos|tú)\b/i);
});
