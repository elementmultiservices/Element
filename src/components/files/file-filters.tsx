import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import type { CategoryOption } from "@/lib/files/queries";
import { FILE_KINDS, FILE_TYPES } from "@/lib/files/rules";
import type { FileListParams } from "@/lib/validation/files";

/** GET form: filters live in the URL, so they are shareable and work without JavaScript. */
export async function FileFilters({
  params,
  categories,
  basePath,
}: {
  params: FileListParams;
  categories: CategoryOption[];
  basePath: "/dashboard";
}) {
  const t = await getTranslations("Files.filters");
  const locale = await getLocale();

  return (
    <form method="get" role="search" aria-label={t("heading")} className="rounded-lg border bg-card p-4">
      <input type="hidden" name="sort" value={params.sort} />
      <input type="hidden" name="dir" value={params.dir} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4 lg:max-w-xl">
          <Label htmlFor="filter-q">{t("search")}</Label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder={t("searchPlaceholder")}
            maxLength={100}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-type">{t("type")}</Label>
          <NativeSelect id="filter-type" name="type" defaultValue={params.type ?? ""}>
            <option value="">{t("allTypes")}</option>
            {FILE_KINDS.map((k) => (
              <option key={k} value={k}>
                {FILE_TYPES[k].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-category">{t("category")}</Label>
          <NativeSelect id="filter-category" name="category" defaultValue={params.category ?? ""}>
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "es" ? c.nameEs : c.nameEn}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">{t("from")}</Label>
          <Input id="filter-from" name="from" type="date" defaultValue={params.from ?? ""} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-to">{t("to")}</Label>
          <Input id="filter-to" name="to" type="date" defaultValue={params.to ?? ""} className="h-10" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
        <Button asChild type="button" variant="outline" size="sm">
          <Link href={basePath}>{t("clear")}</Link>
        </Button>
      </div>
    </form>
  );
}
