/**
 * Element — link office client records to accounts by the last four digits of
 * their tax ID (SSN, ITIN or EIN).
 *
 *   npm run import:clients -- --csv "C:\path\list 1.csv" --csv "C:\path\list 2.csv" [--locale es] [--apply]
 *
 * Reads the "Taxpayer / Spouse ID / Email" exports (either the "Taxpayer Name"
 * or the "Taxpayer First Name" layout). Every taxpayer — and every spouse with
 * an email and ID of their own — becomes one candidate keyed by email:
 *
 *   - account exists       → profiles.id_last4 is set (never overwritten if it
 *                            already holds different digits)
 *   - account missing      → created like the Drive import (role 'user', upload
 *                            allowed, unconfirmed, no email sent) with id_last4
 *   - no email             → not created
 *
 * Skipped and reported: no or malformed ID, invalid, misspelled or placeholder
 * email, test records, administrator emails, emails shared by more than one
 * ID (an office or relative's mailbox: linking would attach someone else's
 * ID) and new accounts for an ID that appears under several emails.
 * The full ID is only held in memory; the report shows the last four digits.
 *
 * Without --apply nothing is written (dry run). Re-running is safe.
 * Requires migration 20261023000200_profile_id_last4.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { emailSchema } from "../src/lib/validation/auth";

const SOURCE = "client-list-import";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function csv(rows: Record<string, string>[], columns: string[]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
type Candidate = { email: string; rawEmail: string; name: string; taxId: string; source: string; role: "taxpayer" | "spouse" };
type ReportRow = { email: string; name: string; last4: string; source: string; action: string; detail: string };

const clean = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const last4 = (taxId: string) => (taxId.length === 9 ? taxId.slice(5) : "");
const TEST_NAME = /\b(ESTIMADOS?|ESTIMA DO|PRUEBAS?|TEST|PRACTICA|SIN DEPENDER|DEPENDER)\b/i;

function readCandidates(file: string, report: ReportRow[]): Candidate[] {
  const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const headerAt = rows.findIndex((r) => clean(r[0]) === "Taxpayer ID");
  if (headerAt < 0) throw new Error(`No "Taxpayer ID" header in ${file}`);
  const header = rows[headerAt]!.map(clean);
  const col = (name: string) => header.indexOf(name);
  const c = {
    id: col("Taxpayer ID"),
    fullName: col("Taxpayer Name"),
    first: col("Taxpayer First Name"),
    last: col("Taxpayer Last Name"),
    email: col("Taxpayer Email Address"),
    spouseId: col("Spouse ID"),
    spouseName: col("Spouse Name"),
    spouseEmail: col("Spouse Email Address"),
  };
  const base = path.basename(file);
  const out: Candidate[] = [];

  rows.slice(headerAt + 1).forEach((r, i) => {
    const source = `${base}#${headerAt + i + 2}`;
    if (/^Totals/i.test(clean(r[0])) || r.every((v) => !clean(v))) return;
    const spouseName = clean(r[c.spouseName]);
    // "Taxpayer Name" holds "A & B" on joint returns; keep only the taxpayer.
    let name =
      c.fullName >= 0 ? clean(r[c.fullName]) : [clean(r[c.first]), clean(r[c.last])].filter(Boolean).join(" ");
    if (spouseName && name.toUpperCase().endsWith(` & ${spouseName.toUpperCase()}`)) {
      name = name.slice(0, -(spouseName.length + 3)).trim();
    }

    const push = (role: Candidate["role"], who: string, idRaw: string, emailRaw: string) => {
      const taxId = idRaw.replace(/\D/g, "");
      if (!emailRaw) {
        if (role === "taxpayer") report.push({ email: "", name: who, last4: last4(taxId), source, action: "skipped", detail: "no_email" });
        return;
      }
      out.push({ email: emailRaw.replace(/\s+/g, "").toLowerCase(), rawEmail: emailRaw, name: who, taxId, source, role });
    };
    push("taxpayer", name, clean(r[c.id]), clean(r[c.email]));
    if (spouseName || clean(r[c.spouseEmail])) push("spouse", spouseName, clean(r[c.spouseId]), clean(r[c.spouseEmail]));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Email checks
// ---------------------------------------------------------------------------
const PROVIDERS = [
  "gmail.com", "hotmail.com", "hotmail.es", "yahoo.com", "yahoo.es", "icloud.com", "outlook.com",
  "aol.com", "live.com", "me.com", "msn.com", "mail.com", "proton.me", "protonmail.com",
];

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** Reason to skip the address, or null. Typos would hand an account to a stranger. */
function emailProblem(email: string): string | null {
  if (!emailSchema.safeParse(email).success || (email.match(/@/g) ?? []).length !== 1) return "invalid_email";
  const [local = "", domain = ""] = email.split("@");
  if (PROVIDERS.includes(domain)) {
    if (local.length <= 2) return "truncated_email";
    // "jon@", "pablo@", "emaill@": placeholders typed when the client had none,
    // real mailboxes of strangers on free providers.
    if (/^[a-z]{1,5}$/.test(local) || /^(e-?mail+|correo|test|prueba|none|noemail|na)$/.test(local)) return "placeholder_email";
    return null;
  }
  const label = domain.split(".")[0]!;
  if (PROVIDERS.some((p) => p.split(".")[0] === label) || PROVIDERS.some((p) => distance(domain, p) <= 2)) {
    return "misspelled_domain";
  }
  if (/(gmail|hotmail|yahoo|icloud|outlook)\.com./.test(domain)) return "misspelled_domain";
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      csv: { type: "string", multiple: true },
      report: { type: "string" },
      locale: { type: "string", default: "en" },
      apply: { type: "boolean", default: false },
    },
  });
  const apply = values.apply;
  const files = (values.csv ?? []).map((f) => path.resolve(f));
  if (files.length === 0) fail('Provide one or more --csv "C:\\path\\file.csv".');
  for (const f of files) if (!fs.existsSync(f)) fail(`File not found: ${f}`);
  const locale = values.locale === "es" ? "es" : "en";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportFile = path.resolve(
    values.report ?? path.join(path.dirname(files[0]!), `clients-import-${apply ? "apply" : "dry-run"}-${stamp}.csv`),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`${apply ? "APPLY" : "DRY RUN (nothing is written; add --apply to import)"}`);
  console.log(`Target: ${url}\n`);

  const { error: columnError } = await supabase.from("profiles").select("id_last4").limit(1);
  const hasColumn = !columnError;
  if (!hasColumn) {
    if (apply) fail("profiles.id_last4 is missing: run migration 20261023000200_profile_id_last4.sql first.");
    console.log("• profiles.id_last4 is missing (migration pending): existing digits are not compared.\n");
  }

  const report: ReportRow[] = [];
  const candidates = files.flatMap((f) => readCandidates(f, report));
  const skip = (cand: Candidate, detail: string) =>
    report.push({ email: cand.email, name: cand.name, last4: last4(cand.taxId), source: cand.source, action: "skipped", detail });

  // Row-level checks, then group the survivors by email.
  const byEmail = new Map<string, Candidate[]>();
  for (const cand of candidates) {
    if (TEST_NAME.test(cand.name)) {
      skip(cand, "test_record");
      continue;
    }
    if (cand.taxId.length !== 9) {
      skip(cand, cand.taxId ? "malformed_id" : "no_id");
      continue;
    }
    const problem = emailProblem(cand.email);
    if (problem) {
      skip(cand, `${problem}: ${cand.rawEmail}`);
      continue;
    }
    byEmail.set(cand.email, [...(byEmail.get(cand.email) ?? []), cand]);
  }

  // One email, one ID. A mailbox shared by several IDs cannot be linked safely.
  const accounts: { email: string; name: string; taxId: string; sources: string[]; corrected: boolean }[] = [];
  for (const [email, group] of byEmail) {
    const ids = [...new Set(group.map((g) => g.taxId))];
    if (ids.length > 1) {
      for (const g of group) skip(g, `shared_email: ${ids.length} different IDs use it (${ids.map(last4).join(", ")})`);
      continue;
    }
    const best = group.find((g) => g.role === "taxpayer") ?? group[0]!;
    accounts.push({
      email,
      name: best.name.slice(0, 120),
      taxId: ids[0]!,
      sources: [...new Set(group.map((g) => g.source))],
      corrected: group.some((g) => /\s/.test(g.rawEmail)),
    });
  }

  // Same ID under several emails: existing accounts are still linked, but no
  // new account is created (it would duplicate the person); pick one by hand.
  const emailsPerId = new Map<string, string[]>();
  for (const a of accounts) emailsPerId.set(a.taxId, [...(emailsPerId.get(a.taxId) ?? []), a.email]);

  const stats = { created: 0, linked: 0, alreadyLinked: 0, conflicts: 0, failed: 0 };
  const audits: Database["public"]["Tables"]["audit_logs"]["Insert"][] = [];
  accounts.sort((a, b) => a.email.localeCompare(b.email));

  let n = 0;
  for (const a of accounts) {
    n++;
    const digits = last4(a.taxId);
    const notes = [
      a.corrected ? "spaces removed from email" : "",
      (emailsPerId.get(a.taxId)?.length ?? 0) > 1 ? `same ID also used by ${emailsPerId.get(a.taxId)!.filter((e) => e !== a.email).join(" ")}` : "",
    ].filter(Boolean);
    const row: ReportRow = { email: a.email, name: a.name, last4: digits, source: a.sources.join(" | "), action: "", detail: notes.join("; ") };
    report.push(row);

    const { data: existingId, error: lookupError } = await supabase.rpc("auth_user_id_by_email", { p_email: a.email });
    if (lookupError) fail(`Could not query users (${lookupError.code}).`);

    if (existingId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select(hasColumn ? "role, id_last4" : "role")
        .eq("id", existingId)
        .maybeSingle<{ role: string; id_last4?: string | null }>();
      if (profile?.role === "admin") {
        row.action = "skipped";
        row.detail = ["email_is_admin", ...notes].join("; ");
        continue;
      }
      if (profile?.id_last4 === digits) {
        row.action = "already_linked";
        stats.alreadyLinked++;
        continue;
      }
      if (profile?.id_last4) {
        row.action = "skipped";
        row.detail = [`last4_conflict: account already holds ${profile.id_last4}`, ...notes].join("; ");
        stats.conflicts++;
        continue;
      }
      row.action = apply ? "linked" : "would_link";
      stats.linked++;
      if (apply) {
        const { error } = await supabase.from("profiles").update({ id_last4: digits }).eq("id", existingId);
        if (error) {
          row.action = "failed";
          row.detail = [`update_failed: ${error.code}`, ...notes].join("; ");
          stats.linked--;
          stats.failed++;
          continue;
        }
        audits.push({ actor_id: null, action: "user.id_linked", target_type: "user", target_id: existingId, metadata: { source: SOURCE } });
      }
    } else if ((emailsPerId.get(a.taxId)?.length ?? 0) > 1) {
      row.action = "skipped";
      row.detail = ["id_multiple_emails: not created, choose one address", ...notes].join("; ");
    } else {
      row.action = apply ? "created" : "would_create";
      stats.created++;
      if (apply) {
        // No password and unconfirmed: no email is sent; the invitation can be
        // (re)sent later from the admin panel.
        const { data, error } = await supabase.auth.admin.createUser({
          email: a.email,
          email_confirm: false,
          user_metadata: { full_name: a.name, preferred_locale: locale },
        });
        if (error || !data.user) {
          row.action = "failed";
          row.detail = [`create_user_failed: ${error?.code ?? "unknown"}`, ...notes].join("; ");
          stats.created--;
          stats.failed++;
          continue;
        }
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ can_upload: true, id_last4: digits })
          .eq("id", data.user.id);
        if (profileError) row.detail = [`profile_update_failed: ${profileError.code}`, ...notes].join("; ");
        audits.push({ actor_id: null, action: "user.imported", target_type: "user", target_id: data.user.id, metadata: { source: SOURCE, locale } });
      }
    }
    if (n % 50 === 0) console.log(`  ${n}/${accounts.length}`);
    if (apply && audits.length >= 100) await supabase.from("audit_logs").insert(audits.splice(0));
  }
  if (apply && audits.length) await supabase.from("audit_logs").insert(audits.splice(0));

  const order = ["created", "would_create", "linked", "would_link", "already_linked", "failed", "skipped"];
  report.sort((x, y) => order.indexOf(x.action) - order.indexOf(y.action) || x.detail.localeCompare(y.detail) || x.email.localeCompare(y.email));
  fs.writeFileSync(reportFile, csv(report, ["action", "detail", "email", "name", "last4", "source"]));

  const skipped = report.filter((r) => r.action === "skipped").reduce<Record<string, number>>((acc, r) => {
    const k = r.detail.split(":")[0]!.split(";")[0]!;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    [
      "",
      `Candidates with email: ${candidates.length}`,
      `Accounts: ${accounts.length}`,
      `  ${apply ? "created" : "to create"}: ${stats.created}`,
      `  ${apply ? "linked" : "to link"} (existing): ${stats.linked}`,
      `  already linked: ${stats.alreadyLinked}`,
      `  last4 conflicts: ${stats.conflicts}`,
      `  failed: ${stats.failed}`,
      "Skipped:",
      ...Object.entries(skipped).map(([k, v]) => `  ${k}: ${v}`),
      "",
      `Report: ${reportFile}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => fail(`Unexpected error${error instanceof Error ? `: ${error.message}` : "."}`));
