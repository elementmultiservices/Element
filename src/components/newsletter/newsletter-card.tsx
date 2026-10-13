import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { issueFormToken } from "@/lib/security/form-token";
import { cn } from "@/lib/utils";
import { NewsletterForm } from "./newsletter-form";

/** Navy sign-up card used on the home page and the blog. */
export async function NewsletterCard({ source, className }: { source: "home" | "blog"; className?: string }) {
  const t = await getTranslations("Newsletter.card");
  const formToken = await issueFormToken("newsletter");

  return (
    <section
      aria-labelledby={`newsletter-${source}`}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_60%,#2B56B3_100%)] p-7 text-white",
        className,
      )}
    >
      <span aria-hidden="true" className="motion-float absolute -right-16 -bottom-20 size-56 rounded-full bg-sky/25 blur-3xl" />
      <span className="relative flex size-10 items-center justify-center rounded-full bg-white/10">
        <Mail aria-hidden="true" className="size-[18px] text-azure-300" />
      </span>
      <h2 id={`newsletter-${source}`} className="relative text-2xl leading-tight font-semibold text-white">
        {t("title")}
      </h2>
      <p className="relative text-[15px] leading-relaxed text-azure-100">{t("body")}</p>
      <NewsletterForm formToken={formToken} source={source} className="relative" />
    </section>
  );
}
