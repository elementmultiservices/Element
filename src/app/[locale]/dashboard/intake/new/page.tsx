import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntakeForm } from "@/components/intake/intake-form";
import { PageHeader } from "@/components/layout/page-header";
import { toLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { taxYearOptions } from "@/lib/intake/schema";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/intake/new">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: toLocale(locale), path: "/dashboard/intake/new", page: "intakeNew", noIndex: true });
}

export default async function NewIntakePage({ params }: PageProps<"/[locale]/dashboard/intake/new">) {
  const { locale } = await params;
  setRequestLocale(toLocale(locale));
  const session = await requireUser();
  const t = await getTranslations();

  // Best-effort prefill from the profile name ("First Last …").
  const [firstName = "", ...rest] = session.fullName.trim().split(/\s+/);

  return (
    <>
      <PageHeader
        title={t("Intake.new.title")}
        description={t("Intake.new.description")}
        breadcrumbs={[
          { label: t("Panel.dashboardTitle"), href: "/dashboard" },
          { label: t("Panel.user.intake"), href: "/dashboard/intake" },
          { label: t("Intake.new.title") },
        ]}
      />
      <div className="max-w-4xl">
        <IntakeForm
          taxYears={taxYearOptions()}
          defaults={{ firstName: firstName.slice(0, 60), lastName: rest.join(" ").slice(0, 60), email: session.email ?? "" }}
        />
      </div>
    </>
  );
}
