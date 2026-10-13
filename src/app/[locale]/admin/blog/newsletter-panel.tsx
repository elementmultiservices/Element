import { getFormatter, getTranslations } from "next-intl/server";
import { Mail, Send } from "lucide-react";
import { effectiveStatus, type AdminPost } from "@/lib/blog/queries";
import { countActiveSubscribers, listSendsForPost } from "@/lib/newsletter/queries";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { SendNewsletterButton } from "./newsletter-send-button";

/**
 * Shown on the post editor: once a post is published, offers to email it to
 * every active subscriber and lists previous sends.
 */
export async function NewsletterPanel({ post, supabase }: { post: AdminPost; supabase: ServerSupabaseClient }) {
  const t = await getTranslations("Admin.blog.newsletter");
  const format = await getFormatter();
  const [active, sends] = await Promise.all([countActiveSubscribers(supabase), listSendsForPost(supabase, post.id)]);
  const published = effectiveStatus(post) === "published";
  const ready = active !== null;
  const highlight = published && ready && sends.length === 0 && (active ?? 0) > 0;

  return (
    <section
      aria-labelledby="newsletter-panel"
      className={cn(
        "flex flex-col gap-5 rounded-[24px] border bg-white p-6 sm:flex-row sm:items-center sm:justify-between",
        highlight ? "border-electric shadow-[0_18px_40px_rgba(27,131,244,0.15)]" : "border-azure-50",
      )}
    >
      <div className="flex items-start gap-4">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", highlight ? "bg-electric text-white" : "bg-azure-25 text-electric")}>
          <Mail aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="newsletter-panel" className="text-lg font-semibold text-ink">
            {t("title")}
          </h2>
          <p className="text-sm text-graphite">
            {!ready
              ? t("notReady")
              : !published
                ? t("publishFirst")
                : (active ?? 0) === 0
                  ? t("noSubscribers")
                  : t("ready", { count: active ?? 0 })}
          </p>
          {sends.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-graphite">
              {sends.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <Send aria-hidden="true" className="size-3 text-electric" />
                  {t("sentOn", { date: format.dateTime(new Date(s.createdAt), "long"), count: s.recipients })}
                  {s.failed > 0 ? <span className="text-destructive">· {t("failed", { count: s.failed })}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {ready && published && (active ?? 0) > 0 ? (
        <SendNewsletterButton postId={post.id} count={active ?? 0} again={sends.length > 0} />
      ) : null}
    </section>
  );
}
