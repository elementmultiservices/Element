import { describe, expect, it } from "vitest";
import { jsonLdHtml, postalAddress } from "@/lib/structured-data";

describe("business structured data", () => {
  it("splits the office address into PostalAddress parts", () => {
    expect(postalAddress("2330 Cambreleng Ave, Bronx, NY 10458")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "2330 Cambreleng Ave",
      addressLocality: "Bronx",
      addressRegion: "NY",
      postalCode: "10458",
      addressCountry: "US",
    });
  });

  it("returns null for addresses in another shape (the text is used as is)", () => {
    expect(postalAddress("Bronx, New York")).toBeNull();
  });

  it("cannot close the script tag", () => {
    expect(jsonLdHtml({ name: "</script><script>" })).not.toContain("</script>");
  });
});
