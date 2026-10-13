"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import NextImage from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Eye, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { savePostAction, type PostField, type PostState } from "@/actions/admin-blog";
import { RichTextEditor } from "@/components/blog/rich-text-editor";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type EditorPost = {
  id: string;
  status: "draft" | "scheduled" | "published";
  publishedAt: string | null;
  categoryId: string | null;
  coverUrl: string | null;
  kind: "article" | "update";
  isFeatured: boolean;
  sourceUrl: string | null;
  translations: Partial<Record<AppLocale, { title: string; slug: string; excerpt: string; content: string }>>;
};

export type EditorCategory = { id: string; label: string };

const STATUSES = ["draft", "scheduled", "published"] as const;

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in Bogotá time (UTC-5, no DST). */
function toBogotaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(0, 16);
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function PostEditor({ post, categories }: { post: EditorPost | null; categories: EditorCategory[] }) {
  const t = useTranslations("Admin.blog");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
  const te = useTranslations("Errors");
  const uiLocale = useLocale() as AppLocale;
  const router = useRouter();

  const [active, setActive] = useState<AppLocale>(uiLocale);
  const [filled, setFilled] = useState<Record<AppLocale, { title: boolean; content: boolean }>>(() => {
    const out = {} as Record<AppLocale, { title: boolean; content: boolean }>;
    for (const l of locales) out[l] = { title: !!post?.translations[l]?.title, content: !!post?.translations[l]?.content };
    return out;
  });
  const tabRefs = useRef<Partial<Record<AppLocale, HTMLButtonElement | null>>>({});

  const { state, onSubmit, pending } = useProtectedAction<PostField>(savePostAction, {
    onSuccess: (result) => {
      const saved = result as PostState;
      if (!post && saved.postId) {
        toast.success(t("editor.created"));
        router.replace(`/admin/blog/${saved.postId}`);
      } else {
        toast.success(t("editor.saved"));
        router.refresh();
      }
    },
  });
  const fe = (f: PostField) => (state.fieldErrors?.[f] ? tv(state.fieldErrors[f]) : undefined);
  const localeHasError = (l: AppLocale) => (["title", "slug", "excerpt", "content"] as const).some((k) => state.fieldErrors?.[`${l}.${k}`]);

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = locales.indexOf(active);
    const next = locales[(i + (e.key === "ArrowRight" ? 1 : locales.length - 1)) % locales.length]!;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-6">
      {post ? <CoverManager postId={post.id} initialUrl={post.coverUrl} /> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {post ? <input type="hidden" name="id" value={post.id} /> : null}
        {state.status === "error" && state.error ? <FormAlert variant="error">{te(state.error)}</FormAlert> : null}
        {state.fieldErrors?.translations ? <FormAlert variant="error">{tv(state.fieldErrors.translations)}</FormAlert> : null}

        <section aria-labelledby="post-settings" className="rounded-[24px] border border-azure-50 bg-white p-6">
          <h2 id="post-settings" className="text-lg">
            {t("editor.settings")}
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-status">{t("editor.status")}</Label>
              <NativeSelect id="post-status" name="status" defaultValue={post?.status ?? "draft"}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-published-at">{t("editor.publishedAt")}</Label>
              <Input
                id="post-published-at"
                name="publishedAt"
                type="datetime-local"
                defaultValue={toBogotaInput(post?.publishedAt ?? null)}
                aria-invalid={fe("publishedAt") ? true : undefined}
                aria-describedby="post-published-at-hint post-published-at-error"
                className="h-10"
              />
              <p id="post-published-at-hint" className="text-xs text-muted-foreground">
                {t("editor.publishedAtHint")}
              </p>
              <FieldError id="post-published-at-error" message={fe("publishedAt")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-category">{t("editor.category")}</Label>
              <NativeSelect id="post-category" name="categoryId" defaultValue={post?.categoryId ?? ""}>
                <option value="">{t("editor.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="mt-6 grid gap-5 border-t border-azure-50 pt-6 md:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">{t("editor.kind")}</legend>
              <div className="flex flex-wrap gap-2">
                {(["article", "update"] as const).map((k) => (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-azure-25 px-4 py-2 text-sm text-ink has-checked:bg-electric has-checked:text-white"
                  >
                    <input type="radio" name="kind" value={k} defaultChecked={(post?.kind ?? "article") === k} className="sr-only" />
                    {t(`editor.kinds.${k}`)}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("editor.kindHint")}</p>
            </fieldset>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink">{t("editor.featured")}</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-azure-25 px-4 py-2.5 text-sm text-ink">
                <input type="checkbox" name="featured" defaultChecked={post?.isFeatured ?? false} className="size-4 accent-[var(--brand-electric)]" />
                {t("editor.featuredLabel")}
              </label>
              <p className="text-xs text-muted-foreground">{t("editor.featuredHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-source">{t("editor.sourceUrl")}</Label>
              <Input
                id="post-source"
                name="sourceUrl"
                type="url"
                placeholder="https://www.irs.gov/…"
                defaultValue={post?.sourceUrl ?? ""}
                maxLength={1000}
                aria-invalid={fe("sourceUrl") ? true : undefined}
                aria-describedby="post-source-hint post-source-error"
              />
              <p id="post-source-hint" className="text-xs text-muted-foreground">
                {t("editor.sourceUrlHint")}
              </p>
              <FieldError id="post-source-error" message={fe("sourceUrl")} />
            </div>
          </div>
        </section>

        <section aria-labelledby="post-content" className="rounded-[24px] border border-azure-50 bg-white">
          <div className="px-6 pt-6">
            <h2 id="post-content" className="text-lg">
              {t("editor.languagesHeading")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("editor.languagesHint")}</p>
          </div>
          <div role="tablist" aria-label={t("editor.languagesHeading")} className="mt-4 flex gap-1 border-b px-6">
            {locales.map((l) => {
              const missing = !filled[l].title || !filled[l].content;
              const error = localeHasError(l);
              return (
                <button
                  key={l}
                  ref={(el) => {
                    tabRefs.current[l] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${l}`}
                  aria-controls={`panel-${l}`}
                  aria-selected={active === l}
                  tabIndex={active === l ? 0 : -1}
                  onClick={() => setActive(l)}
                  onKeyDown={onTabKey}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
                    active === l ? "border-electric text-electric" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tc(`languages.${l}`)}
                  {error ? (
                    <span className="rounded-sm bg-error-bg px-1.5 py-0.5 text-xs text-destructive">!</span>
                  ) : missing ? (
                    <span className="rounded-sm bg-warning-bg px-1.5 py-0.5 text-xs font-normal text-warning">
                      {t("missing")}
                      <span className="sr-only"> — {t("editor.tabMissing")}</span>
                    </span>
                  ) : (
                    <span className="rounded-sm bg-success-bg px-1.5 py-0.5 text-xs font-normal text-success">{t("complete")}</span>
                  )}
                </button>
              );
            })}
          </div>

          {locales.map((l) => {
            const tr = post?.translations[l];
            const id = (f: string) => `post-${l}-${f}`;
            return (
              <div key={l} role="tabpanel" id={`panel-${l}`} aria-labelledby={`tab-${l}`} hidden={active !== l} className="space-y-5 p-6" lang={l}>
                <div className="space-y-1.5">
                  <Label htmlFor={id("title")}>{t("editor.title")}</Label>
                  <Input
                    id={id("title")}
                    name={`${l}.title`}
                    defaultValue={tr?.title ?? ""}
                    maxLength={200}
                    className="h-10 text-base"
                    aria-invalid={fe(`${l}.title`) ? true : undefined}
                    aria-describedby={id("title-error")}
                    onChange={(e) => setFilled((f) => ({ ...f, [l]: { ...f[l], title: e.target.value.trim() !== "" } }))}
                  />
                  <FieldError id={id("title-error")} message={fe(`${l}.title`)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={id("slug")}>{t("editor.slug")}</Label>
                  <Input
                    id={id("slug")}
                    name={`${l}.slug`}
                    defaultValue={tr?.slug ?? ""}
                    maxLength={200}
                    className="h-10 font-mono text-sm"
                    aria-invalid={fe(`${l}.slug`) ? true : undefined}
                    aria-describedby={`${id("slug-hint")} ${id("slug-error")}`}
                  />
                  <p id={id("slug-hint")} className="text-xs text-muted-foreground">
                    {t("editor.slugHint", { locale: l, slug: tr?.slug || "…" })}
                  </p>
                  <FieldError id={id("slug-error")} message={fe(`${l}.slug`)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={id("excerpt")}>{t("editor.excerpt")}</Label>
                  <Textarea
                    id={id("excerpt")}
                    name={`${l}.excerpt`}
                    defaultValue={tr?.excerpt ?? ""}
                    maxLength={500}
                    rows={2}
                    aria-describedby={`${id("excerpt-hint")} ${id("excerpt-error")}`}
                  />
                  <p id={id("excerpt-hint")} className="text-xs text-muted-foreground">
                    {t("editor.excerptHint")}
                  </p>
                  <FieldError id={id("excerpt-error")} message={fe(`${l}.excerpt`)} />
                </div>
                <div className="space-y-1.5">
                  <p id={id("content-label")} className="text-sm leading-none font-medium">
                    {t("editor.content")}
                  </p>
                  <RichTextEditor
                    name={`${l}.content`}
                    labelId={id("content-label")}
                    defaultValue={tr?.content ?? ""}
                    lang={l}
                    invalid={!!fe(`${l}.content`)}
                    describedBy={id("content-error")}
                    onChange={(html) => setFilled((f) => ({ ...f, [l]: { ...f[l], content: html !== "" } }))}
                  />
                  <FieldError id={id("content-error")} message={fe(`${l}.content`)} />
                </div>
              </div>
            );
          })}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} label={t("editor.save")} pendingLabel={t("editor.saving")} className="w-auto" />
          {post
            ? locales
                .filter((l) => post.translations[l])
                .map((l) => (
                  <Button key={l} asChild variant="outline">
                    <a href={`/${uiLocale}/admin/blog/${post.id}/preview?lang=${l}`} target="_blank" rel="noopener">
                      <Eye aria-hidden="true" />
                      {t("editor.previewLanguage", { language: tc(`languages.${l}`) })}
                    </a>
                  </Button>
                ))
            : null}
        </div>
      </form>
    </div>
  );
}

function CoverManager({ postId, initialUrl }: { postId: string; initialUrl: string | null }) {
  const t = useTranslations("Admin.blog.editor");
  const te = useTranslations("Errors");
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(false);
    if (file.size > 4 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return setError(true);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/admin/blog/${postId}/cover`, { method: "POST", body, credentials: "same-origin" });
      if (!res.ok) return setError(true);
      setUrl(URL.createObjectURL(file));
      toast.success(t("coverUpdated"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/cover`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) {
        setUrl(null);
        toast.success(t("coverRemoved"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="post-cover" className="rounded-[24px] border border-azure-50 bg-white p-6">
      <h2 id="post-cover" className="text-lg">
        {t("coverHeading")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("coverHint")}</p>
      {error ? (
        <FormAlert variant="error" className="mt-4">
          {te("coverInvalid")}
        </FormAlert>
      ) : null}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {url ? (
          <div className="relative aspect-[16/9] w-full max-w-xs overflow-hidden rounded-2xl border border-azure-50 bg-mist">
            <NextImage src={url} alt={t("coverAlt")} fill unoptimized className="object-cover" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="post-cover-file"
            onChange={(e) => {
              const file = e.target.files?.item(0);
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ImageUp aria-hidden="true" />}
            {busy ? t("coverUploading") : url ? t("coverReplace") : t("coverUpload")}
          </Button>
          {url ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={remove} className="text-destructive hover:bg-error-bg hover:text-destructive">
              <Trash2 aria-hidden="true" />
              {t("coverRemove")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
