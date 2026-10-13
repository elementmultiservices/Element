import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, ChartNoAxesColumn, FileText, IdCard, Newspaper, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { coverUrl, type PostSummary } from "@/lib/blog/queries";
import { cn } from "@/lib/utils";

// Covers for posts without an image: a gradient and an icon, picked per post.
const FALLBACKS: { bg: string; icon: LucideIcon; dark?: boolean }[] = [
  { bg: "bg-[linear-gradient(150deg,#13295A_0%,#3167DB_100%)]", icon: ShieldCheck, dark: true },
  { bg: "bg-[linear-gradient(160deg,#F0F7FF_0%,#A1D3FB_100%)]", icon: ChartNoAxesColumn },
  { bg: "bg-[linear-gradient(160deg,#C5E3FB_0%,#53A0F8_100%)]", icon: FileText },
  { bg: "bg-[linear-gradient(150deg,#050D29_0%,#13295A_100%)]", icon: IdCard, dark: true },
  { bg: "bg-[linear-gradient(160deg,#F0F7FF_0%,#DDEEFD_100%)]", icon: Newspaper },
  { bg: "bg-[linear-gradient(150deg,#3167DB_0%,#53A0F8_100%)]", icon: CalendarDays, dark: true },
];

function fallbackFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACKS[hash % FALLBACKS.length] ?? FALLBACKS[0]!;
}

export function PostCover({ post, className, sizes, iconClass = "size-10" }: { post: PostSummary; className?: string; sizes: string; iconClass?: string }) {
  const src = coverUrl(post.coverPath);
  const fallback = fallbackFor(post.id);
  const Icon = fallback.icon;
  return (
    <div className={cn("relative overflow-hidden", !src && fallback.bg, className)}>
      {src ? (
        // Covers are public images from our own storage; served as-is.
        <Image src={src} alt="" fill unoptimized sizes={sizes} className="object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <Icon className={cn(iconClass, "transition-transform duration-700 group-hover:scale-110", fallback.dark ? "text-white/85" : "text-cobalt")} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

/** Blog grid card: cover with category chip, date, title and "Read article". */
export async function PostCard({ post }: { post: PostSummary }) {
  const t = await getTranslations("Blog");
  const format = await getFormatter();

  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-[24px] border border-azure-50 bg-mist p-3 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(5,13,41,0.08)]">
      <div className="relative">
        <PostCover post={post} className="aspect-[16/10] rounded-[18px]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {post.kind === "update" ? (
            <span className="rounded-lg bg-electric px-2.5 py-1 text-xs font-semibold text-white">{t("kinds.update")}</span>
          ) : null}
          {post.category ? <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-ink">{post.category.name}</span> : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-2 pb-3">
        <time dateTime={post.publishedAt} className="font-mono text-xs text-graphite">
          {format.dateTime(new Date(post.publishedAt), { day: "numeric", month: "short", year: "numeric" })}
          {post.readingMinutes ? ` · ${t("minutes", { count: post.readingMinutes })}` : null}
        </time>
        <h3 className="text-lg leading-snug font-semibold text-ink">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-electric">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? <p className="line-clamp-2 text-sm text-graphite">{post.excerpt}</p> : null}
        <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-electric px-4 py-2 text-sm font-semibold text-white">
          {t("readArticle")}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
