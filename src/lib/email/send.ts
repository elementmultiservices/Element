import "server-only";
import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { isProduction, serverEnv } from "@/lib/env";

export type SendEmailInput = { to: string; subject: string; react: ReactElement };

/**
 * Sends a transactional email through Resend. In development without an API
 * key, the plain-text version is printed to the server console instead (so
 * links can be tested locally); serverEnv() forbids this in production.
 */
export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<boolean> {
  const env = serverEnv();

  if (!env.RESEND_API_KEY) {
    if (isProduction) return false;
    const text = await render(react, { plainText: true });
    console.info(`\n[email:dev] subject="${subject}"\n${text}\n`);
    return true;
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, react });
    if (error) {
      console.error(`[email] send failed: ${error.name}`);
      return false;
    }
    return true;
  } catch {
    console.error("[email] send threw");
    return false;
  }
}
