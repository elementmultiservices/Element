import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

type Tree = { [key: string]: string | Tree } | Tree[];

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogues", () => {
  const enKeys = flatten(en as unknown as Tree);
  const esKeys = flatten(es as unknown as Tree);

  it("have exactly the same keys in English and Spanish", () => {
    const missingInEs = [...enKeys.keys()].filter((k) => !esKeys.has(k));
    const missingInEn = [...esKeys.keys()].filter((k) => !enKeys.has(k));
    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("have no empty translations", () => {
    const empty = [...enKeys, ...esKeys].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("use the same ICU placeholders in both languages", () => {
    const mismatched = [...enKeys.keys()].filter(
      (k) => JSON.stringify(placeholders(enKeys.get(k) ?? "")) !== JSON.stringify(placeholders(esKeys.get(k) ?? "")),
    );
    expect(mismatched).toEqual([]);
  });

  it("keep the product name untranslated", () => {
    expect(en.Metadata.siteName).toBe("Element");
    expect(es.Metadata.siteName).toBe("Element");
  });
});
