import { getTranslations } from "next-intl/server";
import { CalendarDays, MessageCircle, Phone } from "lucide-react";
import { SmartLink } from "@/components/marketing/smart-link";
import { getSiteContact } from "@/lib/site-settings";

/** Quick contact actions pinned to the bottom of the screen on phones. */
export async function MobileActionBar() {
  const t = await getTranslations("Nav");
  const contact = await getSiteContact();
  const item = "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-semibold";

  return (
    <nav
      aria-label={t("book")}
      className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-azure-50 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      <SmartLink href={contact.phoneHref} className={`${item} text-ink`}>
        <Phone aria-hidden="true" className="size-5" />
        {t("call")}
      </SmartLink>
      <SmartLink href={contact.whatsappHref} className={`${item} text-ink`}>
        <MessageCircle aria-hidden="true" className="size-5" />
        {t("whatsapp")}
      </SmartLink>
      <SmartLink href={contact.bookingHref} className={`${item} bg-electric text-white`}>
        <CalendarDays aria-hidden="true" className="size-5" />
        {t("bookShort")}
      </SmartLink>
    </nav>
  );
}
