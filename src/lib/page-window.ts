/** Page numbers to show: always the first, the last and the neighbours of the current one. */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  // Fill a single hidden page instead of showing "…" for it.
  if (pages.has(3) && !pages.has(2) && pageCount >= 3) pages.add(2);
  if (pages.has(pageCount - 2) && !pages.has(pageCount - 1)) pages.add(pageCount - 1);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("gap");
    out.push(p);
  });
  return out;
}
