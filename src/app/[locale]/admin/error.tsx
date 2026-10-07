"use client";

import { PanelError } from "@/components/states/panel-error";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PanelError digest={error.digest} reset={reset} />;
}
