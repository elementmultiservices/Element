import "./globals.css";

// The <html> element is rendered by app/[locale]/layout.tsx so that the `lang`
// attribute always matches the active locale.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
