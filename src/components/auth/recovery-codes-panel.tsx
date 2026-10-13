"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Download, KeyRound } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";

/**
 * Shows freshly issued recovery codes exactly once. Continuing requires the
 * person to confirm they saved them.
 */
export function RecoveryCodesPanel({ codes, onContinue, continueLabel }: { codes: string[]; onContinue: () => void; continueLabel?: string }) {
  const t = useTranslations("Auth.mfa");
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([`${t("fileHeader")}\n\n${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "element-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound aria-hidden="true" className="size-5 text-link" />
        <h2 id={`${id}-title`} className="text-lg">
          {t("codesTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("codesBody")}</p>
      <FormAlert variant="info">{t("codesWarning")}</FormAlert>
      <ul aria-label={t("codesListLabel")} className="grid grid-cols-2 gap-2 rounded-2xl border border-azure-50 bg-mist p-4 font-mono text-sm" data-testid="recovery-codes">
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download aria-hidden="true" />
          {t("download")}
        </Button>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
        {t("savedConfirm")}
      </label>
      <Button type="button" className="h-10 w-full" disabled={!saved} onClick={onContinue}>
        {continueLabel ?? t("continue")}
      </Button>
    </section>
  );
}
