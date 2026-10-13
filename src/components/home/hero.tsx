import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Check, Folder, FolderOpen, MessageCircle } from "lucide-react";
import { SmartLink } from "@/components/marketing/smart-link";
import { Button } from "@/components/ui/button";
import { getSiteContact } from "@/lib/site-settings";
import { delay } from "@/components/marketing/motion";
import { container } from "@/components/marketing/section-intro";
import { TrustTicker } from "./trust-ticker";

export async function Hero() {
  const t = await getTranslations("Home");
  const contact = await getSiteContact();

  const bullets = ["price", "yearRound", "language"] as const;
  const folders = [
    { key: "taxes", count: 6 },
    { key: "itin", count: 3 },
    { key: "business", count: 12 },
  ] as const;
  const trust = (["irs", "notary", "afsp", "languages", "yearRound"] as const).map((key) => ({
    key,
    label: t(`trust.${key}`),
  }));

  return (
    <>
      <section aria-labelledby="hero-title" className={`${container} grid items-center gap-10 pt-6 pb-16 lg:grid-cols-2 lg:gap-12 lg:pt-10 lg:pb-[72px]`}>
        <div className="flex flex-col items-start gap-7">
          <p
            style={delay(0)}
            className="motion-enter inline-flex items-center gap-2.5 rounded-full border border-azure-50 bg-azure-25 py-2 pr-3.5 pl-2 text-sm text-navy"
          >
            <span className="rounded-full bg-electric px-2 py-0.5 font-mono text-[11px] text-white">NY</span>
            {t("hero.badge")}
          </p>
          <h1
            id="hero-title"
            style={delay(1)}
            className="motion-enter text-[clamp(36px,11.5vw,44px)] leading-[0.98] font-semibold tracking-[-0.03em] text-ink sm:text-6xl lg:text-[clamp(56px,5vw,72px)]"
          >
            {/* Three lines in both languages: the start splits evenly over two, the accent takes the third. */}
            <span className="block text-balance">{t("hero.titleStart")}</span> <span className="block text-electric">{t("hero.titleAccent")}</span>
          </h1>
          <p style={delay(2)} className="motion-enter max-w-[540px] text-lg leading-relaxed text-graphite lg:text-xl lg:leading-[30px]">
            {t("hero.body")}
          </p>
          <div style={delay(3)} className="motion-enter flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button asChild variant="brand" size="pill-lg" className="group shadow-[0_10px_24px_rgba(27,131,244,0.28)]">
              <SmartLink href={contact.bookingHref}>
                {t("hero.book")}
                <ArrowUpRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </SmartLink>
            </Button>
            <Button asChild variant="ink" size="pill-lg">
              <SmartLink href={contact.whatsappHref}>
                <MessageCircle aria-hidden="true" />
                {t("hero.whatsapp")}
              </SmartLink>
            </Button>
          </div>
          <ul style={delay(4)} className="motion-enter flex flex-wrap gap-x-[22px] gap-y-2">
            {bullets.map((key) => (
              <li key={key} className="flex items-center gap-2 text-[15px] text-navy">
                <Check aria-hidden="true" className="size-[18px] text-cobalt" strokeWidth={2.2} />
                {t(`hero.bullets.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <figure
          aria-label={t("mockup.label")}
          style={delay(2)}
          className="motion-enter-scale relative flex min-h-[480px] items-center justify-center overflow-hidden rounded-[28px] bg-[linear-gradient(165deg,#F0F7FF_0%,#C5E3FB_42%,#53A0F8_82%,#3167DB_100%)] px-5 py-14 sm:min-h-[600px] sm:rounded-[36px] sm:px-6"
        >
          <span aria-hidden="true" className="motion-float absolute -top-24 -right-20 size-72 rounded-full bg-white/40 blur-3xl" />
          <span aria-hidden="true" className="motion-float absolute -bottom-28 -left-16 size-80 rounded-full bg-royal/30 blur-3xl [animation-delay:-3s]" />
          <div className="motion-float relative w-full max-w-[360px] rounded-[28px] bg-white p-[22px] shadow-[0_40px_48px_rgba(5,13,41,0.22)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-graphite">{t("mockup.greeting")}</p>
                <p className="text-xl font-semibold text-ink">{t("mockup.title")}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-azure-25">
                <FolderOpen aria-hidden="true" className="size-[18px] text-cobalt" />
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-[20px] bg-[linear-gradient(135deg,#13295A_0%,#3167DB_100%)] p-[18px]">
              <p className="font-mono text-[11px] tracking-[0.1em] text-azure-200">{t("mockup.returnLabel")}</p>
              <p className="text-[22px] leading-tight font-semibold text-white">{t("mockup.returnStatus")}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <div style={delay(6)} className="motion-grow-x h-full w-full bg-azure-300" />
              </div>
              <div className="flex justify-between text-xs text-azure-100">
                <span>{t("mockup.steps.received")}</span>
                <span>{t("mockup.steps.review")}</span>
                <span>{t("mockup.steps.filed")}</span>
              </div>
            </div>
            <p className="mt-4 text-[13px] font-semibold text-graphite">{t("mockup.foldersHeading")}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {folders.map(({ key, count }, i) => (
                <li
                  key={key}
                  style={delay(6 + i)}
                  className="motion-enter flex items-center gap-3 rounded-[14px] bg-azure-25 px-3 py-2.5"
                >
                  <Folder aria-hidden="true" className="size-5 text-cobalt" />
                  <span className="flex-1 text-[15px] font-medium text-ink">{t(`mockup.folders.${key}`)}</span>
                  <span className="font-mono text-xs text-graphite">{t("mockup.files", { count })}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={delay(9)} className="motion-enter-scale absolute top-6 left-5 sm:top-10 sm:left-6">
            <p className="motion-float flex items-center gap-2 rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-sm font-medium text-white shadow-[0_12px_18px_rgba(5,13,41,0.25)] [animation-delay:-2s]">
              {t("mockup.toast")}
              <span className="flex size-[22px] items-center justify-center rounded-full bg-sky">
                <Check aria-hidden="true" className="size-[13px]" strokeWidth={2.6} />
              </span>
            </p>
          </div>
        </figure>
      </section>

      <TrustTicker items={trust} label={t("trust.label")} pauseLabel={t("trust.pause")} playLabel={t("trust.play")} />
    </>
  );
}
