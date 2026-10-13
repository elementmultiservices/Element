import { getTranslations } from "next-intl/server";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { delay } from "@/components/marketing/motion";

/**
 * Authentication layout: the form on the left and a brand panel (hidden on
 * small screens) on the right, matching the public site's hero.
 */
export async function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const t = await getTranslations("AuthPanel");
  const points = [
    { key: "organized", icon: Check },
    { key: "protected", icon: Lock },
    { key: "twoStep", icon: ShieldCheck },
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-14">
      <div className="motion-enter flex flex-col justify-center rounded-[28px] border border-azure-50 bg-white p-6 shadow-[0_30px_60px_rgba(5,13,41,0.06)] sm:p-10 lg:rounded-[36px] lg:p-14">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]">{title}</h1>
          {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-graphite">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <aside
        aria-hidden="true"
        style={delay(2)}
        className="motion-enter-scale relative hidden min-h-[560px] flex-col justify-between overflow-hidden rounded-[36px] bg-[linear-gradient(165deg,#F0F7FF_0%,#C5E3FB_42%,#53A0F8_82%,#3167DB_100%)] p-10 lg:flex"
      >
        <span className="motion-float absolute -top-24 -right-20 size-72 rounded-full bg-white/40 blur-3xl" />
        <span className="motion-float absolute -bottom-28 -left-16 size-80 rounded-full bg-royal/30 blur-3xl [animation-delay:-3s]" />
        <div className="relative flex flex-col items-start gap-5">
          <span className="rounded-full bg-white/70 px-3.5 py-1.5 text-sm font-medium text-navy">{t("badge")}</span>
          <p className="max-w-[420px] text-[40px] leading-[1.02] font-semibold tracking-[-0.02em] text-ink">{t("title")}</p>
        </div>
        <div className="relative flex flex-col gap-3">
          <span className="motion-float flex items-center gap-2 self-end rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-sm font-medium text-white shadow-[0_12px_18px_rgba(5,13,41,0.25)] [animation-delay:-2s]">
            {t("toast")}
            <span className="flex size-[22px] items-center justify-center rounded-full bg-sky">
              <Check className="size-[13px]" strokeWidth={2.6} />
            </span>
          </span>
          <ul className="flex flex-col gap-2 rounded-[24px] bg-white p-5 shadow-[0_30px_48px_rgba(5,13,41,0.2)]">
            {points.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-3 rounded-[14px] bg-azure-25 px-3.5 py-3 text-[15px] font-medium text-ink">
                <Icon className="size-[18px] text-cobalt" />
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
