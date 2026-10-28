"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { ArrowUpRight, XIcon } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { STATE_REFUNDS, type RefundStep } from "@/lib/state-refunds";

/**
 * "Check your state refund": a dialog where the visitor picks a state and gets
 * the official lookup page plus step-by-step instructions with screenshots.
 */
export function StateRefundDialog({ triggerClassName, label }: { triggerClassName?: string; label?: string }) {
  const t = useTranslations("FaqPage.refundStates");
  const [code, setCode] = useState("");
  const state = STATE_REFUNDS.find((s) => s.code === code);

  const stepText = (step: RefundStep) => {
    switch (step.kind) {
      case "click":
        return t("steps.click", { label: step.label });
      case "fill":
        return t("steps.fill");
      case "find":
        return t("steps.find");
      case "fillGeneric":
        return t("steps.fillGeneric");
    }
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger className={triggerClassName}>
        {label ?? t("trigger")}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(5,13,41,0.25)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <div className="flex items-start gap-4 border-b border-azure-50 p-6 sm:p-7">
            <div className="flex flex-1 flex-col gap-2">
              <Dialog.Title className="text-xl font-semibold text-ink sm:text-2xl">{t("title")}</Dialog.Title>
              <Dialog.Description className="text-sm leading-relaxed text-graphite">{t("description")}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full p-2 text-graphite transition-colors hover:bg-azure-25 hover:text-ink">
              <XIcon aria-hidden="true" className="size-5" />
              <span className="sr-only">{t("close")}</span>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto p-6 sm:p-7">
            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              {t("select")}
              <NativeSelect value={code} onChange={(e) => setCode(e.target.value)} className="h-12 text-base">
                <option value="" disabled>
                  {t("placeholder")}
                </option>
                {STATE_REFUNDS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </label>

            {state ? (
              <div key={state.code} className="flex flex-col gap-6">
                <a
                  href={state.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-electric px-4 py-3 text-sm font-semibold text-white hover:bg-electric/90"
                >
                  {t("open", { state: state.name })}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>

                <section className="flex flex-col gap-4">
                  <h3 className="text-base font-semibold text-ink">{t("stepsTitle")}</h3>
                  <ol className="flex flex-col gap-6">
                    {[{ kind: "open" as const }, ...state.steps].map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-azure-25 font-mono text-sm font-semibold text-electric">
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5 text-sm leading-relaxed text-graphite">
                          <p>{step.kind === "open" ? t("steps.open") : stepText(step)}</p>
                          {step.kind === "fill" ? (
                            <>
                              <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-electric">
                                {step.fields.map((f) => (
                                  <li key={f}>{t(`fields.${f}`)}</li>
                                ))}
                              </ul>
                              <p>{step.submit ? t("steps.submit", { label: step.submit }) : t("steps.submitGeneric")}</p>
                            </>
                          ) : null}
                          {"shot" in step && step.shot ? (
                            <Image
                              src={`/refund-status/${step.shot}.webp`}
                              alt={t("shotAlt", { state: state.name, n: i + 1 })}
                              width={1100}
                              height={739}
                              sizes="(min-width: 672px) 560px, 90vw"
                              className="h-auto w-full rounded-xl border border-azure-50"
                            />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-graphite">{t("note")}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
