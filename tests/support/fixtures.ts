/**
 * Test fixtures shared by the integration (Vitest) and end-to-end (Playwright)
 * suites. They run ONLY against the local Supabase stack: the service role key
 * is read from .env.local and the URL must be a loopback address.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]!] = m[2]!;
    }
  } catch {
    // fall back to process.env
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string")) };
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  throw new Error("Tests must run against the local Supabase stack (npm run db:start).");
}

export type Db = SupabaseClient<Database>;

export function serviceClient(): Db {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; password: string; role: "user" | "admin" };

/** Creates a confirmed account with a unique email (prefix "e2e-"). */
export async function createTestUser(label: string, options: { role?: "user" | "admin"; isActive?: boolean } = {}): Promise<TestUser> {
  const admin = serviceClient();
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `T${randomBytes(12).toString("base64url")}a1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label}`, preferred_locale: "en" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const role = options.role ?? "user";
  const { error: upErr } = await admin.from("profiles").update({ role, is_active: options.isActive ?? true }).eq("id", data.user.id);
  if (upErr) throw new Error(`profile update failed: ${upErr.message}`);
  return { id: data.user.id, email, password, role };
}

/** Signed-in client with a real session (RLS sees the user's JWT). */
export async function signedInClient(user: TestUser): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`signIn failed for ${user.email}: ${error.code}`);
  return client;
}

export function totp(secret: string, offset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "")) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/** Enrolls TOTP and upgrades the client's session to aal2. */
export async function elevateWithMfa(client: Db): Promise<void> {
  const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `e2e-${randomUUID().slice(0, 6)}` });
  if (error || !data) throw new Error(`mfa enroll failed: ${error?.message}`);
  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (verifyError) throw new Error(`mfa verify failed: ${verifyError.message}`);
}

export const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF", "latin1");

/** Stores a file for `owner` directly (service role), as the confirm step would. */
export async function createStoredFile(owner: TestUser, name = "fixture.pdf"): Promise<{ id: string; storagePath: string }> {
  const admin = serviceClient();
  const storagePath = `${owner.id}/${randomUUID()}`;
  const { error: upErr } = await admin.storage.from("files").upload(storagePath, PDF_BYTES, { contentType: "application/pdf" });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
  const { data, error } = await admin
    .from("files")
    .insert({
      owner_id: owner.id,
      uploaded_by: owner.id,
      original_name: name,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: PDF_BYTES.length,
      checksum_sha256: "0".repeat(64),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`files insert failed: ${error?.message}`);
  return { id: data.id, storagePath };
}

/** Removes fixture users and everything they own. */
export async function deleteTestUsers(users: TestUser[]): Promise<void> {
  const admin = serviceClient();
  for (const user of users) {
    const { data: files } = await admin.from("files").select("id, storage_path").or(`owner_id.eq.${user.id},uploaded_by.eq.${user.id}`);
    if (files?.length) {
      await admin.storage.from("files").remove(files.map((f) => f.storage_path));
      await admin.from("files").delete().in("id", files.map((f) => f.id));
    }
    await admin.from("upload_intents").delete().or(`owner_id.eq.${user.id},requested_by.eq.${user.id}`);
    await admin.auth.admin.deleteUser(user.id);
  }
}
