import { describe, expect, it } from "vitest";
import { irsSources, mergeIrsUpdates, parseIrsArticle, parseIrsDate, parseIrsListing } from "@/lib/irs/newsroom";
import { pageWindow } from "@/lib/page-window";

// Shape of the IRS newsroom listing pages (news releases, tax tips, fact sheets).
const LISTING = `
  <div class="field--item">
<div class="field_pup_media_document_teaser">
  <h2>
    <a href="/newsroom/irs-recognizes-national-whistleblower-day-with-8-billion-recovered-since-2007" rel="bookmark">
      <span>IRS recognizes National Whistleblower Day with $8 billion recovered since 2007</span>
    </a>
  </h2>
</div>
            <div class="field field--name-field-pup-description-abstract field--type-string-long field--label-hidden field__item">IR-2026-84, July 28, 2026 — The Internal Revenue Service today highlighted the upcoming National Whistleblower Day. </div>
      </div>
  <div class="field--item">
<div class="field_pup_media_document_teaser">
  <h2><a href="/newsroom/taxpayer-bill-of-rights" rel="bookmark"><span>Taxpayer Bill of Rights series: Defining the right to a fair &amp; just tax system</span></a></h2>
</div>
            <div class="field field--name-field-pup-description-abstract field--type-string-long field--label-hidden field__item">Tax Tip 2026-73, Sept. 7, 2026 —Fairness is an essential part of the federal tax system.</div>
      </div>
  <div class="field--item"> <div class="field_pup_media_document_teaser">
  <h3>
    <a href='/pub/taxpros/fs-2026-13.pdf'>Updates to questions and answers   <span class="link-label label-file label-file-pdf">PDF</span></a>
  </h3>
</div>
<p><div class="field field--name-field-pup-description-abstract field--type-string-long field--label-hidden field__item">FS-2026-13, August 2026 — This Fact Sheet updates frequently asked questions.</div></p>
</div>
  <div class="field--item">
<div class="field_pup_media_document_teaser">
  <h2><a href="/newsroom/irs2go-to-irs-app-faq" rel="bookmark"><span>IRS2Go to IRS app — Frequently asked questions</span></a></h2>
</div>
            <div class="field field--name-field-pup-description-abstract field--type-string-long field--label-hidden field__item">September 2026 — Frequently asked questions about IRS app.</div>
      </div>
  <div class="field--item">
<div class="field_pup_media_document_teaser">
  <h2><a href="https://evil.example.com/x"><span>Off-site link</span></a></h2>
</div>
            <div class="field field--name-field-pup-description-abstract field--type-string-long field--label-hidden field__item">IR-2026-1, July 1, 2026 — Not from irs.gov.</div>
      </div>`;

describe("parseIrsDate", () => {
  it("reads the IRS date formats", () => {
    expect(parseIrsDate("July 28, 2026")).toBe("2026-07-28");
    expect(parseIrsDate("Sept. 2, 2026")).toBe("2026-09-02");
    expect(parseIrsDate("Sep. 3, 2026")).toBe("2026-09-03");
    expect(parseIrsDate("Oct. 14, 2026")).toBe("2026-10-14");
    expect(parseIrsDate("August 2026")).toBe("2026-08-01");
    expect(parseIrsDate("soon")).toBeNull();
  });

  it("reads the Spanish IRS date formats", () => {
    expect(parseIrsDate("8 de julio de 2026")).toBe("2026-07-08");
    expect(parseIrsDate("7 de julio del 2026")).toBe("2026-07-07");
    expect(parseIrsDate("1ro de octubre de 2026")).toBe("2026-10-01");
    expect(parseIrsDate("29 de septiembre de 2026")).toBe("2026-09-29");
    expect(parseIrsDate("julio de 2026")).toBe("2026-07-01");
  });
});

describe("parseIrsListing", () => {
  const items = parseIrsListing(LISTING, "news-release");

  it("keeps the IRS text word for word", () => {
    expect(items[0]).toEqual({
      category: "news-release",
      title: "IRS recognizes National Whistleblower Day with $8 billion recovered since 2007",
      url: "https://www.irs.gov/newsroom/irs-recognizes-national-whistleblower-day-with-8-billion-recovered-since-2007",
      slug: "irs-recognizes-national-whistleblower-day-with-8-billion-recovered-since-2007",
      code: "IR-2026-84",
      dateLabel: "July 28, 2026",
      date: "2026-07-28",
      summary: "The Internal Revenue Service today highlighted the upcoming National Whistleblower Day.",
      isPdf: false,
    });
    expect(items[1]).toMatchObject({
      title: "Taxpayer Bill of Rights series: Defining the right to a fair & just tax system",
      code: "Tax Tip 2026-73",
      dateLabel: "Sept. 7, 2026",
      summary: "Fairness is an essential part of the federal tax system.",
    });
  });

  it("handles PDFs and items without a number", () => {
    expect(items[2]).toMatchObject({ title: "Updates to questions and answers", url: "https://www.irs.gov/pub/taxpros/fs-2026-13.pdf", isPdf: true, slug: null, code: "FS-2026-13", date: "2026-08-01" });
    expect(items[3]).toMatchObject({ title: "IRS2Go to IRS app — Frequently asked questions", code: null, dateLabel: "September 2026" });
  });

  it("drops links outside irs.gov", () => {
    expect(items.map((i) => i.url).some((u) => u.includes("example.com"))).toBe(false);
    expect(items).toHaveLength(4);
  });
});

describe("mergeIrsUpdates", () => {
  it("dedupes, drops items before July 2026 and sorts newest first", () => {
    const base = { category: "news-release" as const, title: "t", slug: null, dateLabel: "", summary: "", isPdf: false };
    const merged = mergeIrsUpdates([
      [
        { ...base, url: "a", code: "IR-2026-82", date: "2026-07-08" },
        { ...base, url: "old", code: "IR-2026-80", date: "2026-06-30" },
      ],
      [
        { ...base, url: "b", code: "IR-2026-83", date: "2026-07-08" },
        { ...base, url: "a", code: "IR-2026-82", date: "2026-07-08" },
        { ...base, url: "c", code: "IR-2026-90", date: "2026-08-02" },
      ],
    ]);
    expect(merged.map((u) => u.url)).toEqual(["c", "b", "a"]);
  });
});

describe("irsSources", () => {
  it("covers every month since July 2026", () => {
    const urls = irsSources("en", new Date("2026-10-15T12:00:00Z")).map((s) => s.url);
    expect(urls).toContain("https://www.irs.gov/newsroom/news-releases-for-july-2026");
    expect(urls).toContain("https://www.irs.gov/newsroom/tax-tips-for-october-2026");
    expect(urls).not.toContain("https://www.irs.gov/newsroom/news-releases-for-june-2026");
    expect(urls).toContain("https://www.irs.gov/newsroom/fact-sheets");
  });

  it("uses the Spanish pages for Spanish", () => {
    const urls = irsSources("es", new Date("2026-07-15T12:00:00Z")).map((s) => s.url);
    expect(urls).toContain("https://www.irs.gov/es/newsroom/news-releases-for-july-2026");
    expect(urls).toContain("https://www.irs.gov/es/newsroom/irs-tax-tips");
  });
});

describe("Spanish listings", () => {
  const html = `<div class="field_pup_media_document_teaser"><h2><a href="/es/newsroom/irs-simplifies-penalty-relief" rel="bookmark"><span>El IRS simplifica alivio de multas</span></a></h2></div>
    <div class="field field--name-field-pup-description-abstract field__item">Consejo tributario del IRS 2026-72SP, 1ro de octubre de 2026 — Los días del verano quedaron atrás.</div>`;

  it("keeps the Spanish text word for word", () => {
    expect(parseIrsListing(html, "tax-tip")[0]).toMatchObject({
      title: "El IRS simplifica alivio de multas",
      url: "https://www.irs.gov/es/newsroom/irs-simplifies-penalty-relief",
      slug: "irs-simplifies-penalty-relief",
      code: "Consejo tributario del IRS 2026-72SP",
      dateLabel: "1ro de octubre de 2026",
      date: "2026-10-01",
      summary: "Los días del verano quedaron atrás.",
    });
  });
});

describe("parseIrsArticle", () => {
  const page = `<h1 class="pup-page-node-type-article-page__title">IRS simplifies penalty relief</h1>
    <div class="field field--name-body"><h2>Menu body before the article</h2></div>
    <article about="/newsroom/x" class="pup-article full"><div class="row">
      <div class="clearfix text-formatted field field--name-body field__item"><p>IR-2026-83, July 8, 2026</p><div><p>Nested</p></div><p>See <a href="/payments/relief" data-entity-type="node">relief</a>.</p><script>alert(1)</script></div>
      <div class="field field--name-field-icon-links">Share</div>
    </div></article>`;

  it("extracts the article body, sanitized, with absolute irs.gov links", () => {
    const article = parseIrsArticle(page);
    expect(article?.title).toBe("IRS simplifies penalty relief");
    expect(article?.html).toBe(
      '<p>IR-2026-83, July 8, 2026</p><p>Nested</p><p>See <a href="https://www.irs.gov/payments/relief" target="_blank" rel="noopener noreferrer nofollow">relief</a>.</p>',
    );
  });

  it("returns null for pages that are not articles", () => {
    expect(parseIrsArticle("<html><body>404</body></html>")).toBeNull();
  });
});

describe("pageWindow", () => {
  it("shows first, last and neighbours, with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 6)).toEqual([1, 2, "gap", 6]);
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 19, 20]);
  });
});
