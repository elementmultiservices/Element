import { describe, expect, it } from "vitest";
import { plainText, sanitizePostHtml } from "@/lib/blog/sanitize";
import { slugify } from "@/lib/blog/slug";

describe("sanitizePostHtml — XSS vectors", () => {
  const vectors: [string, string][] = [
    ["<script>alert(1)</script><p>ok</p>", "<p>ok</p>"],
    ['<img src=x onerror="alert(1)"><p>ok</p>', "<p>ok</p>"],
    ['<p onclick="alert(1)">hi</p>', "<p>hi</p>"],
    ['<a href="javascript:alert(1)">x</a>', "x"],
    ['<a href="JaVaScRiPt:alert(1)">x</a>', "x"],
    ['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', "x"],
    ['<a href="//evil.example">x</a>', "x"],
    ['<iframe src="https://evil.example"></iframe><p>ok</p>', "<p>ok</p>"],
    ['<svg><script>alert(1)</script></svg><p>ok</p>', "<p>ok</p>"],
    ['<style>body{display:none}</style><p>ok</p>', "<p>ok</p>"],
    ['<p style="background:url(javascript:alert(1))">hi</p>', "<p>hi</p>"],
    ["<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>", ""],
    ['<form action="https://evil"><input name="x"></form><p>ok</p>', "<p>ok</p>"],
  ];

  for (const [input, expected] of vectors) {
    it(`neutralizes ${input.slice(0, 40)}`, () => {
      const out = sanitizePostHtml(input);
      expect(out).toBe(expected);
      expect(out).not.toMatch(/on\w+=|javascript:|<script|<iframe|<style/i);
    });
  }
});

describe("sanitizePostHtml — allowed content", () => {
  it("keeps formatting tags", () => {
    const html = "<h2>T</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p><ul><li>a</li></ul><ol><li>b</li></ol><blockquote><p>q</p></blockquote><hr><pre><code>c</code></pre>";
    expect(sanitizePostHtml(html)).toBe(html.replace("<hr>", "<hr />"));
  });

  it("downgrades h1 to h2", () => {
    expect(sanitizePostHtml("<h1>Title</h1>")).toBe("<h2>Title</h2>");
  });

  it("forces safe attributes on external links", () => {
    expect(sanitizePostHtml('<a href="https://example.com" target="_self" rel="opener">x</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });

  it("keeps well-formed HTML when an unsafe link precedes a valid one", () => {
    expect(sanitizePostHtml('<p><a href="javascript:alert(1)">clic</a> <a href="https://example.com">ext</a> fin</p>')).toBe(
      '<p>clic <a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">ext</a> fin</p>',
    );
  });

  it("keeps mailto and relative links without target", () => {
    expect(sanitizePostHtml('<a href="mailto:a@b.co">m</a>')).toBe('<a href="mailto:a@b.co">m</a>');
    expect(sanitizePostHtml('<a href="/es/contact">c</a>')).toBe('<a href="/es/contact">c</a>');
  });

  it("extracts plain text", () => {
    expect(plainText("<p>  Hola <strong>mundo</strong> </p><p></p>")).toBe("Hola mundo");
    expect(plainText("<p></p>")).toBe("");
  });
});

describe("slugify", () => {
  it("handles Spanish characters and punctuation", () => {
    expect(slugify("¿Qué es la Ley 1581 de 2012?")).toBe("que-es-la-ley-1581-de-2012");
    expect(slugify("Año nuevo, señales y cambios")).toBe("ano-nuevo-senales-y-cambios");
    expect(slugify("  --Hello   World--  ")).toBe("hello-world");
  });
});
