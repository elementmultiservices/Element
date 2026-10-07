/* eslint-disable @next/next/no-html-link-for-pages -- rendered outside the locale tree; plain links are intended. */
// Fallback for requests that never reach a locale segment (the proxy normally
// prefixes every path). Kept minimal and language-neutral; links to both locales.
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", color: "#111827" }}>
        <p style={{ color: "#0b2545", fontWeight: 500, letterSpacing: "0.04em" }}>Element</p>
        <h1 style={{ color: "#0b2545" }}>404</h1>
        <p>
          <a href="/en">English</a> · <a href="/es" lang="es">Español</a>
        </p>
      </body>
    </html>
  );
}
