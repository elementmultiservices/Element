/**
 * Row Level Security and Storage policies, exercised with real sessions against
 * the local Supabase stack (npm run db:start). Run: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createStoredFile,
  createTestUser,
  deleteTestUsers,
  elevateWithMfa,
  serviceClient,
  signedInClient,
  type Db,
  type TestUser,
} from "../support/fixtures";

let userA: TestUser;
let userB: TestUser;
let admin: TestUser;
let clientA: Db;
let clientB: Db;
let fileA: { id: string; storagePath: string };
let fileB: { id: string; storagePath: string };

beforeAll(async () => {
  [userA, userB, admin] = await Promise.all([createTestUser("rls-a"), createTestUser("rls-b"), createTestUser("rls-admin", { role: "admin" })]);
  [fileA, fileB] = await Promise.all([createStoredFile(userA, "a.pdf"), createStoredFile(userB, "b.pdf")]);
  [clientA, clientB] = await Promise.all([signedInClient(userA), signedInClient(userB)]);
});

afterAll(async () => {
  await deleteTestUsers([userA, userB, admin].filter(Boolean));
});

describe("files: users only see their own, non-trashed files", () => {
  it("a user reads their own file row and object", async () => {
    const { data } = await clientA.from("files").select("id").eq("id", fileA.id);
    expect(data).toHaveLength(1);
    const { data: blob, error } = await clientA.storage.from("files").download(fileA.storagePath);
    expect(error).toBeNull();
    expect(blob?.size).toBeGreaterThan(0);
  });

  it("a user cannot read someone else's file row", async () => {
    const { data } = await clientA.from("files").select("id").eq("id", fileB.id);
    expect(data).toEqual([]);
    const { data: all } = await clientA.from("files").select("owner_id");
    expect((all ?? []).every((f) => f.owner_id === userA.id)).toBe(true);
  });

  it("a user cannot download or sign someone else's object", async () => {
    const { error: dlError } = await clientA.storage.from("files").download(fileB.storagePath);
    expect(dlError).not.toBeNull();
    const { data: signed } = await clientA.storage.from("files").createSignedUrl(fileB.storagePath, 60);
    expect(signed?.signedUrl ?? null).toBeNull();
  });

  it("anonymous visitors read nothing", async () => {
    const anon = anonClient();
    const { data: rows } = await anon.from("files").select("id");
    expect(rows ?? []).toEqual([]);
    const { error } = await anon.storage.from("files").download(fileA.storagePath);
    expect(error).not.toBeNull();
  });

  it("trashed files are inaccessible to their owner", async () => {
    const trashed = await createStoredFile(userB, "trashed.pdf");
    await serviceClient().from("files").update({ deleted_at: new Date().toISOString(), deleted_by: admin.id }).eq("id", trashed.id);

    const { data } = await clientB.from("files").select("id").eq("id", trashed.id);
    expect(data).toEqual([]);
    const { error } = await clientB.storage.from("files").download(trashed.storagePath);
    expect(error).not.toBeNull();
    const { data: signed } = await clientB.storage.from("files").createSignedUrl(trashed.storagePath, 60);
    expect(signed?.signedUrl ?? null).toBeNull();
  });

  it("users cannot insert, trash or delete file rows directly", async () => {
    const { error: insertError } = await clientA.from("files").insert({
      owner_id: userA.id,
      uploaded_by: userA.id,
      original_name: "x.pdf",
      storage_path: `${userA.id}/forged`,
      mime_type: "application/pdf",
      size_bytes: 1,
      checksum_sha256: "0".repeat(64),
    });
    expect(insertError).not.toBeNull();

    const { data: updated } = await clientA.from("files").update({ deleted_at: new Date().toISOString(), deleted_by: userA.id }).eq("id", fileA.id).select("id");
    expect(updated ?? []).toEqual([]);
    const { data: deleted } = await clientA.from("files").delete().eq("id", fileA.id).select("id");
    expect(deleted ?? []).toEqual([]);
  });

  it("users cannot upload objects to the private bucket directly", async () => {
    const { error } = await clientA.storage.from("files").upload(`${userA.id}/direct.pdf`, Buffer.from("%PDF-1.4"), { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });
});

describe("profiles: privileges cannot be self-assigned", () => {
  it("a user cannot change their own role, status or quota", async () => {
    for (const patch of [{ role: "admin" as const }, { is_active: false }, { storage_quota_bytes: 10 ** 12 }]) {
      const { error } = await clientA.from("profiles").update(patch).eq("id", userA.id);
      expect(error).not.toBeNull();
    }
    const { data } = await serviceClient().from("profiles").select("role, is_active").eq("id", userA.id).single();
    expect(data).toEqual({ role: "user", is_active: true });
  });

  it("a user can only read their own profile and not their quota", async () => {
    const { data } = await clientA.from("profiles").select("id");
    expect(data?.map((p) => p.id)).toEqual([userA.id]);
    const { error } = await clientA.from("profiles").select("storage_quota_bytes");
    expect(error).not.toBeNull();
  });
});

describe("admin functions and tables", () => {
  it("regular users are refused by every admin function", async () => {
    const calls = [
      clientA.rpc("admin_list_users"),
      clientA.rpc("admin_overview"),
      clientA.rpc("admin_search_audit"),
      clientA.rpc("admin_user_options"),
      clientA.rpc("storage_usage", { p_owner: userA.id }),
    ];
    for (const { error } of await Promise.all(calls)) expect(error?.message).toContain("forbidden");
  });

  it("regular users cannot read audit logs or contact messages", async () => {
    const { data: audit } = await clientA.from("audit_logs").select("id").limit(1);
    expect(audit ?? []).toEqual([]);
    const { data: messages } = await clientA.from("contact_messages").select("id").limit(1);
    expect(messages ?? []).toEqual([]);
  });

  it("an admin WITHOUT MFA has no elevated access", async () => {
    const adminClient = await signedInClient(admin);
    const { data } = await adminClient.from("files").select("id").eq("id", fileA.id);
    expect(data).toEqual([]);
    const { error } = await adminClient.rpc("admin_overview");
    expect(error?.message).toContain("forbidden");
  });

  it("an admin WITH MFA (aal2) reads all files", async () => {
    const adminClient = await signedInClient(admin);
    await elevateWithMfa(adminClient);
    const { data } = await adminClient.from("files").select("id").in("id", [fileA.id, fileB.id]);
    expect(data).toHaveLength(2);
  });
});

describe("MFA recovery codes", () => {
  it("users cannot read hashes, write codes or consume them directly", async () => {
    const service = serviceClient();
    await service.from("mfa_recovery_codes").insert({ user_id: userA.id, code_hash: "a".repeat(64) });

    const { error: hashError } = await clientA.from("mfa_recovery_codes").select("code_hash");
    expect(hashError).not.toBeNull();
    const { data: own } = await clientA.from("mfa_recovery_codes").select("id, used_at");
    expect(own).toHaveLength(1);
    const { data: others } = await clientB.from("mfa_recovery_codes").select("id");
    expect(others ?? []).toEqual([]);

    const { error: insertError } = await clientA.from("mfa_recovery_codes").insert({ user_id: userA.id, code_hash: "b".repeat(64) });
    expect(insertError).not.toBeNull();
    const { error: rpcError } = await clientA.rpc("consume_recovery_code", { p_user: userA.id, p_hash: "a".repeat(64) });
    expect(rpcError).not.toBeNull();

    const { data: remaining } = await clientA.rpc("my_recovery_codes_remaining");
    expect(remaining).toBe(1);
    await service.from("mfa_recovery_codes").delete().eq("user_id", userA.id);
  });
});

describe("audit log is append-only", () => {
  it("not even the service role can update or delete entries", async () => {
    const service = serviceClient();
    const { data: row } = await service.from("audit_logs").insert({ action: "admin.export", metadata: { test: true } }).select("id").single();
    expect(row).not.toBeNull();
    const { error: updateError } = await service.from("audit_logs").update({ action: "tampered" }).eq("id", row!.id);
    expect(updateError).not.toBeNull();
    const { error: deleteError } = await service.from("audit_logs").delete().eq("id", row!.id);
    expect(deleteError).not.toBeNull();
  });
});

describe("deactivated accounts are blocked", () => {
  it("lose data access immediately and cannot sign in again", async () => {
    const victim = await createTestUser("rls-deactivated");
    const own = await createStoredFile(victim, "mine.pdf");
    const client = await signedInClient(victim);
    const { data: before } = await client.from("files").select("id").eq("id", own.id);
    expect(before).toHaveLength(1);

    const service = serviceClient();
    await service.from("profiles").update({ is_active: false }).eq("id", victim.id);
    await service.auth.admin.updateUserById(victim.id, { ban_duration: "876000h" });
    await service.rpc("revoke_user_sessions", { p_user: victim.id });

    // Same (still unexpired) access token: RLS now returns nothing.
    const { data: after } = await client.from("files").select("id").eq("id", own.id);
    expect(after ?? []).toEqual([]);
    const { error: dlError } = await client.storage.from("files").download(own.storagePath);
    expect(dlError).not.toBeNull();

    const { error: signInError } = await anonClient().auth.signInWithPassword({ email: victim.email, password: victim.password });
    expect(signInError).not.toBeNull();
    await deleteTestUsers([victim]);
  });

  it("a revoked session loses access even if the account stays active", async () => {
    const user = await createTestUser("rls-revoked");
    const own = await createStoredFile(user, "mine.pdf");
    const client = await signedInClient(user);
    await serviceClient().rpc("revoke_user_sessions", { p_user: user.id });
    const { data } = await client.from("files").select("id").eq("id", own.id);
    expect(data ?? []).toEqual([]);
    await deleteTestUsers([user]);
  });
});
