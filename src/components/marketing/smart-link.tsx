import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { isExternal } from "@/lib/business";

/** Locale-aware Link for internal paths; plain anchor for WhatsApp, tel: and other external links. */
export function SmartLink({ href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  if (isExternal(href)) {
    const newTab = href.startsWith("http");
    return <a href={href} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props} />;
  }
  return <Link href={href} {...props} />;
}
