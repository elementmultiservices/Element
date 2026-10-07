/** Centered, bordered container for authentication forms. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-lg border bg-card p-6 shadow-xs sm:p-8">
        <h1 className="text-2xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
