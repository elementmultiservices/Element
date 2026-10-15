import sanitizeHtml from "sanitize-html";

/**
 * Allowlist for rich HTML from outside sources (IRS update articles): scripts,
 * styles, event handlers, iframes and dangerous URLs never get through.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "h4", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "a", "br", "hr", "code", "pre"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Content of these tags is dropped entirely (not just the tags).
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math", "template"],
  enforceHtmlBoundary: false,
  transformTags: {
    // h1 is reserved for the page title.
    h1: "h2",
    b: "strong",
    i: "em",
    strike: "s",
    a: (tagName, attribs) => {
      const href = (attribs.href ?? "").trim();
      // Only http(s), mailto and same-site relative links survive; anything else
      // loses its href (an attribute-less <a> is unwrapped in sanitizeRichHtml).
      if (!/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)) return { tagName, attribs: {} };
      const external = /^https?:\/\//i.test(href);
      const safe: sanitizeHtml.Attributes = external ? { href, target: "_blank", rel: "noopener noreferrer nofollow" } : { href };
      return { tagName, attribs: safe };
    },
  },
};

export function sanitizeRichHtml(html: string): string {
  // Links stripped of an unsafe href come out as a bare "<a>": keep only their text.
  return sanitizeHtml(html, OPTIONS)
    .replace(/<a>([\s\S]*?)<\/a>/g, "$1")
    .trim();
}

/** Visible text of a fragment, used to decide whether content is effectively empty. */
export function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
