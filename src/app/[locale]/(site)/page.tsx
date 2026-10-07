import type { Metadata } from "next";
import { FolderLock, LockKeyhole, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PostCard } from "@/components/blog/post-card";
import { toLocale } from "@/i18n/routing";
import { listPublishedPosts } from "@/lib/blog/queries";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/", page: "home" });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const latest = await listPublishedPosts(locale, { limit: 3 });

  const features = [
    { key: "security", icon: ShieldCheck },
    { key: "privacy", icon: FolderLock },
    { key: "support", icon: LockKeyhole },
  ] as const;

  return (
    <>
      <section className="border-b bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-medium tracking-wide text-link uppercase">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-3xl sm:text-4xl">{t("title")}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t("body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in">{t("primaryCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">{t("secondaryCta")}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl">{t("featuresHeading")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-lg border bg-card p-6">
              <Icon aria-hidden="true" className="size-6 text-link" />
              <h3 className="mt-4 text-lg">{t(`features.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl">{t("latestHeading")}</h2>
            {latest.total > 0 ? (
              <Link href="/blog" className="text-sm font-medium text-link hover:underline">
                {t("viewAllPosts")}
              </Link>
            ) : null}
          </div>
          {latest.posts.length === 0 ? (
            <p className="mt-6 text-muted-foreground">{t("latestEmpty")}</p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latest.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
