"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { OwnerPicker, type OwnerOption } from "@/components/files/owner-picker";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRecaptcha } from "@/hooks/use-recaptcha";
import { Link, useRouter } from "@/i18n/navigation";
import { formatBytes, formatPercent } from "@/lib/format";
import type { CategoryOption } from "@/lib/files/queries";
import { checkFileName, FILE_KINDS, MAX_DESCRIPTION_LENGTH, MAX_FILE_BYTES } from "@/lib/files/rules";
import { cn } from "@/lib/utils";

const ERROR_KEYS = [
  "noFile",
  "invalid_name",
  "double_extension",
  "type_not_allowed",
  "too_large",
  "empty_file",
  "quota_exceeded",
  "daily_cap",
  "rate_limited",
  "recaptcha_failed",
  "content_rejected",
  "size_mismatch",
  "upload_missing",
  "intent_invalid",
  "invalid_category",
  "invalid_owner",
  "upload_not_allowed",
  "network",
  "generic",
] as const;
type UploadErrorKey = (typeof ERROR_KEYS)[number];

function toErrorKey(code: unknown): UploadErrorKey {
  return typeof code === "string" && (ERROR_KEYS as readonly string[]).includes(code) ? (code as UploadErrorKey) : "generic";
}

type Phase = "idle" | "preparing" | "uploading" | "verifying" | "done" | "error";

const ACCEPT = FILE_KINDS.map((k) => (k === "jpg" ? ".jpg,.jpeg" : `.${k}`)).join(",");

/** Uploads the file body straight to Supabase Storage with progress events. */
export function putWithProgress(url: string, file: File, contentType: string, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Cache-Control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload_failed")));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export type { OwnerOption };

/**
 * Upload form. Users upload to their own account. Administrators pass `owners`
 * and must pick the account that receives the file (the server re-validates it).
 */
export function UploadForm({
  categories,
  owners,
  defaultOwnerId,
}: {
  categories: CategoryOption[];
  owners?: OwnerOption[];
  defaultOwnerId?: string;
}) {
  const t = useTranslations("Upload");
  const ta = useTranslations("Admin.files");
  const locale = useLocale();
  const router = useRouter();
  const getToken = useRecaptcha();
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UploadErrorKey | null>(null);
  const [ownerError, setOwnerError] = useState(false);
  const [lastOwnerId, setLastOwnerId] = useState<string | null>(null);

  const maxLabel = formatBytes(MAX_FILE_BYTES, locale);
  const busy = phase === "preparing" || phase === "uploading" || phase === "verifying";

  function choose(selected: File | null) {
    setError(null);
    setPhase("idle");
    setProgress(0);
    if (!selected) return setFile(null);
    const check = checkFileName(selected.name);
    if (!check.ok) {
      setFile(null);
      setError(check.reason === "doubleExtension" ? "double_extension" : check.reason === "invalidName" ? "invalid_name" : "type_not_allowed");
      return;
    }
    if (selected.size === 0) return (setFile(null), setError("empty_file"));
    if (selected.size > MAX_FILE_BYTES) return (setFile(null), setError("too_large"));
    setFile(selected);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    choose(e.dataTransfer.files.item(0));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("noFile");
    const check = checkFileName(file.name);
    if (!check.ok) return setError("type_not_allowed");

    const form = new FormData(e.currentTarget);
    const ownerId = owners ? String(form.get("ownerId") ?? "") : null;
    setOwnerError(false);
    if (owners && !ownerId) return setOwnerError(true);
    setLastOwnerId(ownerId);
    setError(null);
    setPhase("preparing");
    try {
      const intent = await postJson("/api/files/upload-intent", {
        name: file.name,
        size: file.size,
        mime: check.mime,
        categoryId: (form.get("categoryId") as string) || null,
        description: (form.get("description") as string) || null,
        ownerId,
        recaptchaToken: await getToken("upload"),
      });
      if (!intent.ok) throw new Error(toErrorKey(intent.data.error));

      setPhase("uploading");
      await putWithProgress(String(intent.data.uploadUrl), file, String(intent.data.contentType), setProgress);

      setPhase("verifying");
      const confirm = await postJson("/api/files/confirm", { intentId: intent.data.intentId });
      if (!confirm.ok) throw new Error(toErrorKey(confirm.data.error));

      setPhase("done");
      router.refresh();
    } catch (err) {
      const key = err instanceof Error ? toErrorKey(err.message === "upload_failed" ? "upload_missing" : err.message) : "generic";
      setError(key);
      setPhase("error");
    }
  }

  function reset() {
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 rounded-[24px] border border-azure-50 bg-white p-6">
        <FormAlert variant="success">{t("status.done")}</FormAlert>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            {t("uploadAnother")}
          </Button>
          <Button asChild variant="outline">
            <Link href={owners ? `/admin/files${lastOwnerId ? `?owner=${lastOwnerId}` : ""}` : "/dashboard"}>{t("viewFiles")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusText =
    phase === "preparing"
      ? t("status.preparing")
      : phase === "uploading"
        ? t("status.uploading", { percent: formatPercent(progress, locale) })
        : phase === "verifying"
          ? t("status.verifying")
          : "";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-[24px] border border-azure-50 bg-white p-6">
      {error ? <FormAlert variant="error">{t(`errors.${error}`, { max: maxLabel })}</FormAlert> : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center rounded-[20px] border-2 border-dashed border-azure-100 bg-mist px-6 py-10 text-center transition-colors",
          dragging ? "border-ring bg-info-bg" : "border-input bg-surface",
        )}
      >
        <FileUp aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">{t("dropzone.title")}</p>
        <p className="text-sm text-muted-foreground">{t("dropzone.or")}</p>
        <input
          ref={inputRef}
          id={`${ids}-file`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => choose(e.target.files?.item(0) ?? null)}
          aria-describedby={`${ids}-hint`}
        />
        <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => inputRef.current?.click()}>
          {file ? t("dropzone.change") : t("dropzone.browse")}
        </Button>
        <p id={`${ids}-hint`} className="mt-3 text-xs text-muted-foreground">
          {t("dropzone.hint", { max: maxLabel })}
        </p>
        {file ? (
          <p className="mt-4 max-w-full truncate rounded-sm bg-background px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">{t("dropzone.selected")}: </span>
            <span className="font-medium">{file.name}</span> · {formatBytes(file.size, locale)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {owners ? (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${ids}-owner`}>
              {ta("ownerLabel")}
              <span aria-hidden="true" className="text-destructive"> *</span>
            </Label>
            <OwnerPicker
              id={`${ids}-owner`}
              name="ownerId"
              owners={owners}
              defaultOwnerId={lastOwnerId ?? defaultOwnerId}
              disabled={busy}
              invalid={ownerError}
              describedBy={ownerError ? `${ids}-owner-error` : undefined}
            />
            {ownerError ? (
              <p id={`${ids}-owner-error`} role="alert" className="text-sm text-destructive">
                {ta("ownerRequired")}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-category`}>{t("fields.category")}</Label>
          <NativeSelect id={`${ids}-category`} name="categoryId" defaultValue="" disabled={busy}>
            <option value="">{t("fields.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "es" ? c.nameEs : c.nameEn}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`${ids}-description`}>{t("fields.description")}</Label>
          <Textarea
            id={`${ids}-description`}
            name="description"
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            disabled={busy}
            aria-describedby={`${ids}-description-hint`}
          />
          <p id={`${ids}-description-hint`} className="text-xs text-muted-foreground">
            {t("fields.descriptionHint")}
          </p>
        </div>
      </div>

      {busy ? (
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2.5 overflow-hidden rounded-full bg-azure-50"
          >
            <div className="h-full rounded-full bg-electric transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {statusText}
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !file}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
