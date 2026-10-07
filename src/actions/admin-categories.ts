"use server";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { categoryCreateSchema, categoryRenameSchema, idSchema } from "@/lib/validation/admin";

export type CategoryField = "nameEn" | "nameEs";
type Result = FormState<never>;

const UNIQUE_VIOLATION = "23505";

async function guard() {
  const session = await requireAdmin();
  const allowed = (await rateLimit("adminActionUser", session.userId)).success;
  return { session, allowed };
}

export async function createCategoryAction(_prev: FormState<CategoryField>, formData: FormData): Promise<FormState<CategoryField>> {
  const { session, allowed } = await guard();
  if (!allowed) return { status: "error", error: "rateLimited" };

  const parsed = categoryCreateSchema.safeParse({ nameEn: formData.get("nameEn"), nameEs: formData.get("nameEs") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<CategoryField>(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("file_categories")
    .insert({ name_en: parsed.data.nameEn, name_es: parsed.data.nameEs })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "error", error: "duplicateName" };
    console.error(`[admin] category create failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }

  await audit({
    actorId: session.userId,
    action: "category.created",
    targetType: "category",
    targetId: data.id,
    metadata: { name_en: parsed.data.nameEn, name_es: parsed.data.nameEs },
  });
  return { status: "success" };
}

export async function renameCategoryAction(_prev: FormState<CategoryField>, formData: FormData): Promise<FormState<CategoryField>> {
  const { session, allowed } = await guard();
  if (!allowed) return { status: "error", error: "rateLimited" };

  const parsed = categoryRenameSchema.safeParse({ id: formData.get("id"), nameEn: formData.get("nameEn"), nameEs: formData.get("nameEs") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<CategoryField>(parsed.error) };

  const supabase = await createClient();
  const { data: before } = await supabase.from("file_categories").select("name_en, name_es").eq("id", parsed.data.id).maybeSingle();
  if (!before) return { status: "error", error: "notFound" };

  const { error } = await supabase
    .from("file_categories")
    .update({ name_en: parsed.data.nameEn, name_es: parsed.data.nameEs })
    .eq("id", parsed.data.id);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "error", error: "duplicateName" };
    console.error(`[admin] category rename failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }

  await audit({
    actorId: session.userId,
    action: "category.renamed",
    targetType: "category",
    targetId: parsed.data.id,
    metadata: { from: { name_en: before.name_en, name_es: before.name_es }, to: { name_en: parsed.data.nameEn, name_es: parsed.data.nameEs } },
  });
  return { status: "success" };
}

async function setArchived(formData: FormData, archived: boolean): Promise<Result> {
  const { session, allowed } = await guard();
  if (!allowed) return { status: "error", error: "rateLimited" };
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error", error: "notFound" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("file_categories")
    .update({ is_archived: archived })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[admin] category archive failed: ${error.code}`);
    return { status: "error", error: "generic" };
  }
  if (!data) return { status: "error", error: "notFound" };

  await audit({ actorId: session.userId, action: archived ? "category.archived" : "category.unarchived", targetType: "category", targetId: data.id });
  return { status: "success" };
}

export async function archiveCategoryAction(_prev: Result, formData: FormData): Promise<Result> {
  return setArchived(formData, true);
}

export async function unarchiveCategoryAction(_prev: Result, formData: FormData): Promise<Result> {
  return setArchived(formData, false);
}
