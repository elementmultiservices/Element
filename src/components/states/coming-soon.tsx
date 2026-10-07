import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "./empty-state";

/** Placeholder for panel sections delivered in later phases. */
export async function ComingSoon() {
  const t = await getTranslations("Panel");
  return <EmptyState icon={Construction} title={t("comingSoonTitle")} body={t("comingSoonBody")} />;
}
