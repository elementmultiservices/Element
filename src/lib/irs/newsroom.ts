import "server-only";
import { unstable_cache } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

/**
 * Updates page: items published in the IRS newsroom (https://www.irs.gov/newsroom
 * and its Spanish version https://www.irs.gov/es/newsroom), read from its public
 * pages and shown word for word.
 */
export const IRS_ORIGIN = "https://www.irs.gov";

/** IRS path prefix for each site language. */
const IRS_PREFIX: Record<AppLocale, string> = { en: "", es: "/es" };

export function irsNewsroomUrl(locale: AppLocale): string {
  return `${IRS_ORIGIN}${IRS_PREFIX[locale]}/newsroom/news-releases-for-current-month`;
}

/** First month shown on the updates page. */
export const UPDATES_SINCE = { year: 2026, month: 7 } as const;
export const UPDATES_PAGE_SIZE = 12;

/** The IRS newsroom types we can list, with the IRS's own label in each language. */
export const IRS_CATEGORIES = {
  "news-release": { en: "News Release", es: "Nota de prensa" },
  "tax-tip": { en: "Tax Tip", es: "Consejo tributario" },
  "fact-sheet": { en: "Fact Sheet", es: "Hoja de datos" },
} as const satisfies Record<string, Record<AppLocale, string>>;
export type IrsCategory = keyof typeof IRS_CATEGORIES;
export const IRS_CATEGORY_KEYS = Object.keys(IRS_CATEGORIES) as [IrsCategory, ...IrsCategory[]];

export type IrsUpdate = {
  category: IrsCategory;
  title: string;
  url: string;
  /** Slug of an IRS newsroom article ("/newsroom/<slug>"), shown on our own page; null for PDFs and other links. */
  slug: string | null;
  /** "IR-2026-84", "Tax Tip 2026-74", "FS-2026-12SP", or null when the IRS gives none. */
  code: string | null;
  /** The date exactly as the IRS writes it ("July 28, 2026", "Sept. 2, 2026", "1ro de octubre de 2026"). */
  dateLabel: string;
  /** ISO date (yyyy-mm-dd) used for sorting and the <time> element; day 1 when the IRS gives only a month. */
  date: string;
  summary: string;
  isPdf: boolean;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const plain = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const isoDate = (year: string, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * IRS dates in English or Spanish -> "yyyy-mm-dd" (day 1 when absent):
 * "July 28, 2026", "Sept. 2, 2026", "August 2026",
 * "8 de julio de 2026", "7 de julio del 2026", "1ro de octubre de 2026", "julio de 2026".
 */
export function parseIrsDate(label: string): string | null {
  const text = label.trim();
  const en = /^([A-Za-z]+)\.?\s+(?:(\d{1,2}),\s*)?(\d{4})$/.exec(text);
  if (en) {
    const month = MONTHS.findIndex((name) => name.startsWith(en[1]!.toLowerCase().slice(0, 3)));
    return month < 0 ? null : isoDate(en[3]!, month, en[2] ? Number(en[2]) : 1);
  }
  const es = /^(?:(\d{1,2})(?:ro|º|°)?\s+de\s+)?([a-záéíóú]+)\s+del?\s+(\d{4})$/i.exec(text);
  if (es) {
    const name = es[2]!.toLowerCase().replace("setiembre", "septiembre");
    const month = MESES.indexOf(name);
    return month < 0 ? null : isoDate(es[3]!, month, es[1] ? Number(es[1]) : 1);
  }
  return null;
}

/** "IR-2026-84, July 28, 2026" -> code + date; "julio de 2026" -> date only. */
function splitHead(head: string): { code: string | null; dateLabel: string; date: string } | null {
  const whole = parseIrsDate(head);
  if (whole) return { code: null, dateLabel: head.trim(), date: whole };
  for (let i = head.indexOf(","); i >= 0; i = head.indexOf(",", i + 1)) {
    const date = parseIrsDate(head.slice(i + 1));
    if (date) return { code: head.slice(0, i).trim() || null, dateLabel: head.slice(i + 1).trim(), date };
  }
  return null;
}

/** "/newsroom/<slug>" or "/es/newsroom/<slug>" on irs.gov -> "<slug>". */
function newsroomSlug(url: URL): string | null {
  const m = /^(?:\/es)?\/newsroom\/([a-z0-9-]+)\/?$/.exec(url.pathname);
  return m ? m[1]! : null;
}

/** Items of an IRS newsroom listing page (title link + "code, date — summary" abstract). */
export function parseIrsListing(html: string, category: IrsCategory): IrsUpdate[] {
  const items: IrsUpdate[] = [];
  const blocks = html.split(/<div class="field_pup_media_document_teaser">/).slice(1);
  for (const block of blocks) {
    const link = /<a\s[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const abstract = /field--name-field-pup-description-abstract[^>]*>([\s\S]*?)<\/div>/i.exec(block);
    if (!link || !abstract) continue;
    const isPdf = /label-file-pdf/.test(link[3]!);
    const title = plain(link[3]!.replace(/<span[^>]*class="[^"]*link-label[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ""));
    const text = plain(abstract[1]!);
    const dash = /\s*[—―–]\s*/.exec(text);
    if (!title || !dash) continue;
    const head = splitHead(text.slice(0, dash.index));
    if (!head) continue;
    let url: URL;
    try {
      url = new URL(decode(link[2]!), IRS_ORIGIN);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || !url.hostname.endsWith("irs.gov")) continue;
    items.push({
      category,
      title,
      url: url.toString(),
      slug: isPdf ? null : newsroomSlug(url),
      ...head,
      summary: text.slice(dash.index + dash[0].length).trim(),
      isPdf,
    });
  }
  return items;
}

/** Listing pages that cover every month from UPDATES_SINCE to `now`, in the IRS version for `locale`. */
export function irsSources(locale: AppLocale, now: Date): { url: string; category: IrsCategory }[] {
  const base = `${IRS_ORIGIN}${IRS_PREFIX[locale]}/newsroom`;
  const sources: { url: string; category: IrsCategory }[] = [
    { url: `${base}/news-releases-for-current-month`, category: "news-release" },
    { url: `${base}/irs-tax-tips`, category: "tax-tip" },
    { url: `${base}/fact-sheets`, category: "fact-sheet" },
  ];
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
  for (let i = UPDATES_SINCE.year * 12 + UPDATES_SINCE.month - 1; i <= end; i++) {
    const slug = `${MONTHS[i % 12]}-${Math.floor(i / 12)}`;
    sources.push({ url: `${base}/news-releases-for-${slug}`, category: "news-release" });
    sources.push({ url: `${base}/tax-tips-for-${slug}`, category: "tax-tip" });
  }
  return sources;
}

const since = isoDate(String(UPDATES_SINCE.year), UPDATES_SINCE.month - 1, 1);

/** Newest first; within a day, the higher release number first. */
function compare(a: IrsUpdate, b: IrsUpdate): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const n = (u: IrsUpdate) => Number(/(\d+)\D*$/.exec(u.code ?? "")?.[1] ?? 0);
  return n(b) - n(a);
}

/** Merges the items of several listings: drops duplicates and items before UPDATES_SINCE. */
export function mergeIrsUpdates(lists: IrsUpdate[][]): IrsUpdate[] {
  const byUrl = new Map<string, IrsUpdate>();
  for (const item of lists.flat()) {
    if (item.date >= since && !byUrl.has(item.url)) byUrl.set(item.url, item);
  }
  return [...byUrl.values()].sort(compare);
}

async function fetchIrsPage(url: string): Promise<string | null> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ElementUpdates/1.0)", Accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  // A month the IRS has not published a page for yet, or an article that was removed.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[irs] ${url} -> ${res.status}`);
  return res.text();
}

async function fetchIrsUpdates(locale: AppLocale): Promise<IrsUpdate[]> {
  // Any failure throws, so the cache keeps serving the last complete list.
  const lists = await Promise.all(
    irsSources(locale, new Date()).map(async (source) => {
      const html = await fetchIrsPage(source.url);
      return html ? parseIrsListing(html, source.category) : [];
    }),
  );
  return mergeIrsUpdates(lists);
}

/** Every IRS update since UPDATES_SINCE in the IRS version for `locale`, refreshed at most once per hour. */
export const getIrsUpdates = unstable_cache(fetchIrsUpdates, ["irs-updates"], { revalidate: 3600 });

/** Same as getIrsUpdates, but null when the IRS site cannot be reached and nothing is cached. */
export async function loadIrsUpdates(locale: AppLocale): Promise<IrsUpdate[] | null> {
  try {
    return await getIrsUpdates(locale);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** An update (with its own page) and the versions the IRS published, keyed by language. */
export type UpdateWithVersions = { slug: string; date: string; versions: Partial<Record<AppLocale, IrsUpdate>> };

/**
 * Every update that has a page on our site, with its English and Spanish
 * versions side by side, newest first. Null when the IRS cannot be reached.
 */
export async function listUpdatesWithVersions(): Promise<UpdateWithVersions[] | null> {
  const [en, es] = await Promise.all([loadIrsUpdates("en"), loadIrsUpdates("es")]);
  if (!en && !es) return null;
  const bySlug = new Map<string, UpdateWithVersions>();
  for (const [locale, list] of [["en", en], ["es", es]] as const) {
    for (const u of list ?? []) {
      if (!u.slug) continue;
      const entry = bySlug.get(u.slug) ?? { slug: u.slug, date: u.date, versions: {} };
      entry.versions[locale] = u;
      bySlug.set(u.slug, entry);
    }
  }
  return [...bySlug.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Both language versions of one update, or null when it is not listed. */
export async function findUpdateVersions(slug: string): Promise<Partial<Record<AppLocale, IrsUpdate>> | null> {
  return (await listUpdatesWithVersions())?.find((u) => u.slug === slug)?.versions ?? null;
}

// ---------------------------------------------------------------------------
// Article content
// ---------------------------------------------------------------------------

/** Inner HTML of the first <div> whose opening tag matches `marker`, from `from` on. */
function innerDiv(html: string, marker: RegExp, from = 0): string | null {
  marker.lastIndex = from;
  const start = marker.exec(html);
  if (!start) return null;
  const open = html.indexOf(">", start.index) + 1;
  const tags = /<(\/?)div\b[^>]*>/gi;
  tags.lastIndex = open;
  let depth = 1;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return html.slice(open, tag.index);
  }
  return null;
}

/**
 * Title and body of an IRS newsroom article page. Links are made absolute to
 * irs.gov and the HTML goes through the rich-HTML allowlist sanitizer.
 */
export function parseIrsArticle(html: string): { title: string; html: string } | null {
  const title = /<h1[^>]*pup-page-node-type-article-page__title[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const article = html.search(/<article\s[^>]*class="pup-article/i);
  if (!title || article < 0) return null;
  const body = innerDiv(html, /<div[^>]*field--name-body[^>]*>/gi, article);
  if (!body) return null;
  const absolute = body.replace(/\shref=(["'])(.*?)\1/gi, (match, quote: string, href: string) => {
    if (/^(https?:|mailto:|#)/i.test(href)) return match;
    try {
      return ` href=${quote}${new URL(decode(href), IRS_ORIGIN).toString()}${quote}`;
    } catch {
      return "";
    }
  });
  return { title: plain(title[1]!), html: sanitizeRichHtml(absolute) };
}

export type IrsArticle = { title: string; html: string; url: string };

async function fetchIrsArticle(locale: AppLocale, slug: string): Promise<IrsArticle | null> {
  const url = `${IRS_ORIGIN}${IRS_PREFIX[locale]}/newsroom/${slug}`;
  const page = await fetchIrsPage(url);
  const parsed = page ? parseIrsArticle(page) : null;
  return parsed ? { ...parsed, url } : null;
}

const cachedIrsArticle = unstable_cache(fetchIrsArticle, ["irs-article"], { revalidate: 21600 });

/**
 * One update with its full content. Only slugs listed on the updates page (in
 * either language) are fetched, so this never proxies arbitrary IRS pages.
 * Returns null when the slug is unknown; throws when the IRS cannot be reached.
 */
export async function getIrsArticle(locale: AppLocale, slug: string): Promise<{ update: IrsUpdate; article: IrsArticle } | null> {
  if (!/^[a-z0-9-]{1,300}$/.test(slug)) return null;
  const other: AppLocale = locale === "es" ? "en" : "es";
  const [mine, theirs] = await Promise.all([loadIrsUpdates(locale), loadIrsUpdates(other)]);
  // An item the IRS has not translated keeps the details of the other version.
  const update = mine?.find((u) => u.slug === slug) ?? theirs?.find((u) => u.slug === slug) ?? null;
  if (!update) return null;
  const article = await cachedIrsArticle(locale, slug);
  return article ? { update, article } : null;
}
