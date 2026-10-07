/**
 * Element — bootstrap the first administrator.
 *
 *   npm run admin:create -- --email admin@example.com --name "Jane Doe" [--locale es]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the environment). The password is typed interactively and never echoed,
 * logged or passed on the command line. If the account already exists it is
 * promoted to admin and reactivated. On first sign-in the admin must enroll
 * TOTP (MFA), which is mandatory for administrators.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { emailSchema, newPasswordSchema } from "../src/lib/validation/auth";

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function promptHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    fail("An interactive terminal is required to type the password (on Windows use PowerShell or Windows Terminal).");
  }
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("cancelled"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      locale: { type: "string", default: "en" },
    },
  });

  const email = emailSchema.safeParse(values.email ?? "");
  if (!email.success) fail("Provide a valid --email.");
  const fullName = (values.name ?? "").trim();
  if (fullName.length < 2 || fullName.length > 120) fail('Provide --name "Full Name" (2–120 characters).');
  const locale = values.locale === "es" ? "es" : "en";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingId, error: lookupError } = await supabase.rpc("auth_user_id_by_email", { p_email: email.data });
  if (lookupError) fail(`Could not query users (${lookupError.code}). Are the migrations applied?`);

  let userId = existingId ?? null;

  if (!userId) {
    const password = await promptHidden("Password (min. 12 chars, upper/lowercase and digits): ");
    const valid = newPasswordSchema.safeParse(password);
    if (!valid.success) fail("The password does not meet the policy (12–128 chars, uppercase, lowercase and digits).");
    const confirm = await promptHidden("Confirm password: ");
    if (confirm !== password) fail("The passwords do not match.");

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.data,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, preferred_locale: locale },
    });
    if (error || !data.user) fail(`Could not create the user (${error?.code ?? "unknown"}).`);
    userId = data.user.id;
    console.log("✔ User created.");
  } else {
    console.log("• The account already exists; it will be promoted to administrator.");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: "admin", is_active: true, full_name: fullName, preferred_locale: locale })
    .eq("id", userId);
  if (updateError) fail(`Could not promote the user (${updateError.code}).`);

  await supabase.from("audit_logs").insert({
    actor_id: null,
    action: "admin.bootstrap",
    target_type: "user",
    target_id: userId,
    metadata: { via: "scripts/create-admin.ts" },
  });

  console.log("✔ Administrator ready.");
  console.log("  Next: sign in at /sign-in and set up two-step verification (mandatory for admins).");
}

main().catch(() => fail("Unexpected error."));
