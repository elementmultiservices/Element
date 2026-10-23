import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { IntakeData } from "./schema";

type Client = SupabaseClient<Database>;

export type IntakeSubmission = Omit<Database["public"]["Tables"]["intake_submissions"]["Row"], "data"> & { data: IntakeData };
export type IntakeUpload = Pick<
  Database["public"]["Tables"]["intake_uploads"]["Row"],
  "id" | "doc_type" | "original_name" | "mime_type" | "size_bytes" | "storage_path" | "created_at"
>;

/**
 * One submission with its documents, read with the caller's own client: RLS
 * returns it only to its owner or to an administrator.
 */
export async function getIntakeSubmission(
  supabase: Client,
  id: string,
): Promise<{ submission: IntakeSubmission; uploads: IntakeUpload[] } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data: submission } = await supabase.from("intake_submissions").select("*").eq("id", id).maybeSingle();
  if (!submission) return null;
  const { data: uploads } = await supabase
    .from("intake_uploads")
    .select("id, doc_type, original_name, mime_type, size_bytes, storage_path, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: true });
  // `data` was validated by intakeDataSchema before it was stored.
  return { submission: submission as IntakeSubmission, uploads: uploads ?? [] };
}

/** Short, non-sequential reference shown to clients and staff. */
export function intakeReference(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
