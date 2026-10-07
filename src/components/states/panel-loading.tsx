import { Skeleton } from "@/components/ui/skeleton";

export function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
