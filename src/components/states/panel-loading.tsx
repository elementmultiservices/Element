import { Skeleton } from "@/components/ui/skeleton";

export function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-[24px]" />
        <Skeleton className="h-28 rounded-[24px]" />
        <Skeleton className="h-28 rounded-[24px]" />
      </div>
      <Skeleton className="h-72 w-full rounded-[24px]" />
    </div>
  );
}
