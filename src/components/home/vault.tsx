import { getTranslations } from "next-intl/server";
import { KeyRound, Lock, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { stagger } from "@/components/marketing/motion";

const features = ["organized", "protected", "handy", "easy"] as const;
const chips = [
  { key: "access", icon: KeyRound },
  { key: "encrypted", icon: Lock },
  { key: "twoStep", icon: ShieldCheck },
] as const;

export async function Vault() {
  const t = await getTranslations("Home.vault");

  const files = [
    { type: "PDF", name: t("mock.return"), meta: "2025", status: t("mock.accepted"), tone: "ok" },
    { type: "JPG", name: t("mock.w2"), meta: t("mock.employer"), status: t("mock.received"), tone: "ok" },
    { type: "!", name: "1099-NEC", meta: "2025", status: t("mock.missing"), tone: "warn" },
  ] as const;

  return (
    <section id="my-files" aria-labelledby="vault-title" className="px-4 pt-8 pb-16 sm:px-6 lg:pb-[72px]">
      <div className="reveal mx-auto grid max-w-[1240px] items-center gap-10 overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#050D29_0%,#13295A_55%,#2B56B3_100%)] p-6 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:rounded-[40px] lg:p-[72px]">
        <div className="flex flex-col items-start gap-6">
          <p className="rounded-full bg-azure-300/16 px-3.5 py-2 text-sm font-medium text-azure-200">{t("badge")}</p>
          <h2
            id="vault-title"
            className="text-[36px] leading-[1.02] font-semibold tracking-[-0.02em] text-white sm:text-5xl lg:text-[60px]"
          >
            {t("title")}
          </h2>
          <p className="max-w-[520px] text-base leading-relaxed text-azure-100 sm:text-lg">{t("body")}</p>
          <ul className="grid w-full grid-cols-2 gap-3">
            {features.map((key, i) => (
              <li key={key} style={stagger(i)} className="reveal flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/6 p-4 sm:p-[18px]">
                <span className="text-[17px] font-semibold text-white">{t(`features.${key}.title`)}</span>
                <span className="text-sm leading-snug text-azure-100 sm:text-[15px]">{t(`features.${key}.body`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure aria-label={t("mock.label")} style={stagger(2)} className="reveal flex flex-col gap-4">
          <div className="motion-float rounded-[28px] bg-white p-5 shadow-[0_40px_60px_rgba(0,0,0,0.3)] sm:p-6">
            <p className="flex items-center gap-2.5 rounded-full bg-azure-25 px-4 py-3 text-[15px] text-graphite">
              <Search aria-hidden="true" className="size-[18px] text-cobalt" />
              {t("mock.search")}
            </p>
            <p className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium">
              {["2026", "2025", "2024", t("mock.business")].map((tab, i) => (
                <span
                  key={tab}
                  className={cn("rounded-full px-3.5 py-1.5", i === 0 ? "bg-ink text-white" : "bg-azure-25 text-navy")}
                >
                  {tab}
                </span>
              ))}
            </p>
            <ul className="mt-4 flex flex-col divide-y divide-azure-50">
              {files.map((file) => (
                <li key={file.name} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-medium",
                      file.tone === "warn" ? "bg-warning-bg text-warning" : "bg-azure-25 text-cobalt",
                    )}
                  >
                    {file.type}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium text-ink">{file.name}</span>
                    <span className="font-mono text-xs text-graphite">{file.meta}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      file.tone === "warn" ? "bg-warning-bg text-warning" : "bg-azure-25 text-cobalt",
                    )}
                  >
                    {file.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="flex flex-wrap gap-2">
            {chips.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/6 px-3.5 py-2 text-[13px] font-medium text-azure-100"
              >
                <Icon aria-hidden="true" className="size-4 text-azure-300" />
                {t(`chips.${key}`)}
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}
