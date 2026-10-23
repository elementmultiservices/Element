// Element — purge-trash Edge Function.
// Invoked daily by pg_cron (see migrations). Authenticated with a shared secret,
// not a user JWT. Deletes the storage object first and then the row, so a
// partial failure is retried safely on the next run (removing a missing object
// is a no-op).
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const RETENTION_DAYS = 30;
const BATCH_SIZE = 100;
const MAX_BATCHES = 20;
const BUCKET = "files";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const secret = Deno.env.get("PURGE_TRASH_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (secret.length < 32 || !timingSafeEqual(auth, `Bearer ${secret}`)) {
    return new Response(null, { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  let purged = 0;
  let failed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: rows, error } = await supabase
      .from("files")
      .select("id, owner_id, storage_path, size_bytes")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff)
      .limit(BATCH_SIZE);

    if (error) {
      console.error("purge-trash: select failed", error.code);
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }
    if (!rows || rows.length === 0) break;

    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(rows.map((r) => r.storage_path));
    if (removeError) {
      console.error("purge-trash: storage remove failed", removeError.name);
      failed += rows.length;
      break;
    }

    const ids = rows.map((r) => r.id);
    const { error: deleteError } = await supabase.from("files").delete().in("id", ids);
    if (deleteError) {
      console.error("purge-trash: row delete failed", deleteError.code);
      failed += rows.length;
      break;
    }

    await supabase.from("audit_logs").insert(
      rows.map((r) => ({
        actor_id: null,
        action: "file.purged",
        target_type: "file",
        target_id: r.id,
        metadata: { owner_id: r.owner_id, size_bytes: r.size_bytes, reason: "retention_30d" },
      })),
    );
    purged += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  // Expired, never-confirmed upload intents: remove pending objects and rows.
  const { data: intents } = await supabase
    .from("upload_intents")
    .select("id, storage_path")
    .is("consumed_at", null)
    .lt("expires_at", new Date(Date.now() - 3_600_000).toISOString())
    .limit(500);

  let intentsCleaned = 0;
  if (intents && intents.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(intents.map((i) => i.storage_path));
    if (!error) {
      await supabase.from("upload_intents").delete().in("id", intents.map((i) => i.id));
      intentsCleaned = intents.length;
    }
  }

  // Intake documents uploaded for a form that was never submitted.
  const { data: intakeUploads } = await supabase
    .from("intake_uploads")
    .select("id, storage_path")
    .is("submission_id", null)
    .lt("expires_at", new Date(Date.now() - 3_600_000).toISOString())
    .limit(500);

  let intakeCleaned = 0;
  if (intakeUploads && intakeUploads.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(intakeUploads.map((u) => u.storage_path));
    if (!error) {
      await supabase.from("intake_uploads").delete().in("id", intakeUploads.map((u) => u.id));
      intakeCleaned = intakeUploads.length;
    }
  }

  return new Response(JSON.stringify({ ok: failed === 0, purged, failed, intentsCleaned, intakeCleaned }), {
    headers: { "Content-Type": "application/json" },
  });
});
