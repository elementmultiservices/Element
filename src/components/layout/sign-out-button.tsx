import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function SignOutButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const t = await getTranslations("Common");
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} size="sm" className={cn("gap-1.5", className)}>
        <LogOut aria-hidden="true" />
        {t("signOut")}
      </Button>
    </form>
  );
}
