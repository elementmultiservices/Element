/**
 * Element — bulk import of client folders exported from Google Drive.
 *
 *   npm run import:drive -- --dir "C:\path\Nextax Scans" --admin-email admin@example.com [--apply]
 *
 * Each sub-folder named "FULL NAME - email@domain" becomes a user account
 * (role 'user', upload allowed, no email sent: the invitation stays pending
 * and can be resent from the admin panel) and every PDF directly inside it is
 * stored in the private "files" bucket with the same checks as the upload
 * flow (size, %PDF signature, active content, quota, SHA-256).
 *
 * Folders sharing one email are merged into a single account. Folders without
 * an email, empty folders and anything rejected are skipped and listed in the
 * report. Without --apply nothing is written (dry run). Re-running is safe:
 * existing accounts are reused and files already stored for the same owner
 * (same checksum) are skipped.
 *
 * Also replaces the example file categories from the seed with the
 * tax-document categories used here.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { inspectFile, sha256Hex } from "../src/lib/files/inspect";
import { checkFileName, MAX_DESCRIPTION_LENGTH, MAX_FILE_BYTES } from "../src/lib/files/rules";
import { emailSchema } from "../src/lib/validation/auth";

const BUCKET = "files";
const LOCALE = "en" as const;
const SOURCE = "drive-import";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const CATEGORIES = {
  fedState: { name_en: "Federal & State Tax Return", name_es: "Declaración federal y estatal" },
  federal: { name_en: "Federal Tax Return", name_es: "Declaración federal" },
  state: { name_en: "State Tax Return", name_es: "Declaración estatal" },
  otherTax: { name_en: "Other Tax Documents", name_es: "Otros documentos tributarios" },
  identity: { name_en: "Identity Documents", name_es: "Documentos de identidad" },
  income: { name_en: "Income Forms", name_es: "Formularios de ingresos" },
  identityIncome: { name_en: "Identity & Income Documents", name_es: "Identidad e ingresos" },
  supporting: { name_en: "Supporting Documents", name_es: "Documentos de soporte" },
} as const;
type CategoryKey = keyof typeof CATEGORIES;

/** Example categories inserted by supabase/seed.sql. */
const EXAMPLE_CATEGORIES = ["Contracts", "Invoices", "Reports", "Certificates"];

const ID_DOC =
  /^(social security( cards?)?|social security card & id|driver license|state id|id|passport|green card|work permit|itin letter|birth certificate.*|ny department of state license)$/i;
const INCOME_FORM = /^(w-2|1099(-nec|-g)?|1098)$/i;

function categorize(label: string): CategoryKey {
  const l = label.trim();
  if (/^federal & state$/i.test(l)) return "fedState";
  if (/^federal$/i.test(l)) return "federal";
  if (/^state$/i.test(l)) return "state";
  if (/^(tax return|schedule c|qbi explanation worksheet|tax letter)$/i.test(l)) return "otherTax";
  const parts = l.split(/\s*&\s*/);
  if (parts.every((p) => ID_DOC.test(p))) return "identity";
  if (parts.every((p) => INCOME_FORM.test(p))) return "income";
  if (parts.every((p) => ID_DOC.test(p) || INCOME_FORM.test(p))) return "identityIncome";
  return "supporting";
}

/**
 * "NAME (1234) - 2025 - Federal & State (2).pdf" → years "2025", label "Federal & State".
 * Either part may be missing.
 */
function parseDocName(fileName: string): { years: string; label: string } {
  const parts = fileName
    .replace(/\.pdf$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .split(" - ")
    .slice(1)
    .map((p) => p.trim());
  const isYears = (p: string) => /^\d{4}( & \d{4})*$/.test(p);
  return { years: parts.filter(isYears).join(" · "), label: parts.filter((p) => !isYears(p)).join(" - ") };
}

// ---------------------------------------------------------------------------
// Folder scan
// ---------------------------------------------------------------------------
type Pdf = { folder: string; name: string; fullPath: string };
type Account = { email: string; names: string[]; folders: string[]; pdfs: Pdf[] };
type ReviewRow = { issue: string; folder: string; email: string; detail: string };
type LogRow = { email: string; folder: string; file: string; category: string; status: string; detail: string };

const FOLDER_RE = /^(.+?)\s+-\s+(\S+@\S+)$/;

/**
 * Addresses that almost certainly do not belong to the client: truncated
 * (all digits or 1–2 characters before the @), misspelled provider domains,
 * or shared/business mailboxes. Inviting them would hand tax documents to a
 * third party, so they are skipped and reported. Short but plausible local
 * parts are imported and only flagged for a check before inviting.
 */
function emailConcern(email: string): { skip: boolean; reason: string } | null {
  const [local = "", domain = ""] = email.split("@");
  if (/^\d+$/.test(local) || local.length <= 2) return { skip: true, reason: "truncated address" };
  if (/^(gmil|gmal|gmai|gamil|hotmal|hotmial|yaho|outlok)\./.test(domain) || !/\.[a-z]{2,6}$/.test(domain)) {
    return { skip: true, reason: "misspelled domain" };
  }
  if (/^(support|info|admin|office|mainoffice|contact|sales|billing|no-?reply)$/.test(local)) {
    return { skip: true, reason: "shared or business mailbox" };
  }
  if (local.length <= 5) return { skip: false, reason: "short address: confirm it before inviting" };
  return null;
}

function scan(dir: string, review: ReviewRow[]): Account[] {
  const accounts = new Map<string, Account>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      review.push({ issue: "loose_file", folder: "", email: "", detail: entry.name });
      continue;
    }
    const folder = entry.name;
    const pdfs = fs
      .readdirSync(path.join(dir, folder), { withFileTypes: true })
      .filter((f) => f.isFile() && /\.pdf$/i.test(f.name))
      .map((f) => ({ folder, name: f.name, fullPath: path.join(dir, folder, f.name) }));

    const match = folder.match(FOLDER_RE);
    if (!match) {
      review.push({ issue: "no_email", folder, email: "", detail: `${pdfs.length} PDF(s) not imported` });
      continue;
    }
    const email = emailSchema.safeParse(match[2]);
    if (!email.success) {
      review.push({ issue: "invalid_email", folder, email: match[2]!, detail: `${pdfs.length} PDF(s) not imported` });
      continue;
    }
    const concern = emailConcern(email.data);
    if (concern?.skip) {
      review.push({ issue: "suspicious_email", folder, email: email.data, detail: `${concern.reason}; ${pdfs.length} PDF(s) not imported` });
      continue;
    }
    if (concern) review.push({ issue: "check_email", folder, email: email.data, detail: concern.reason });
    if (pdfs.length === 0) review.push({ issue: "empty_folder", folder, email: email.data, detail: "account created without files" });

    const account = accounts.get(email.data) ?? { email: email.data, names: [], folders: [], pdfs: [] };
    const name = match[1]!.trim();
    if (!account.names.includes(name)) account.names.push(name);
    account.folders.push(folder);
    account.pdfs.push(...pdfs);
    accounts.set(email.data, account);
  }

  for (const a of accounts.values()) {
    if (a.folders.length > 1) {
      review.push({ issue: "shared_email_merged", folder: a.folders.join(" | "), email: a.email, detail: `one account named "${fullName(a)}"` });
    }
  }
  return [...accounts.values()].sort((a, b) => a.email.localeCompare(b.email));
}

function fullName(a: Account): string {
  return a.names.join(" & ").slice(0, 120);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function csv(rows: Record<string, string>[], columns: string[]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";
}

function writeReport(dir: string, review: ReviewRow[], log: LogRow[], summary: string[]): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "review.csv"), csv(review, ["issue", "folder", "email", "detail"]));
  fs.writeFileSync(path.join(dir, "files.csv"), csv(log, ["email", "folder", "file", "category", "status", "detail"]));
  fs.writeFileSync(path.join(dir, "summary.txt"), summary.join("\r\n") + "\r\n");
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
      dir: { type: "string" },
      "admin-email": { type: "string" },
      report: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  const apply = values.apply;
  const dir = values.dir ? path.resolve(values.dir) : fail('Provide --dir "C:\\path\\to\\folders".');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`Not a folder: ${dir}`);
  const adminEmail = emailSchema.safeParse(values["admin-email"] ?? "");
  if (!adminEmail.success) fail("Provide --admin-email (the administrator recorded as uploader).");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve(values.report ?? path.join(path.dirname(dir), `import-report-${apply ? "apply" : "dry-run"}-${stamp}`));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = supabase.storage.from(BUCKET);

  console.log(`${apply ? "APPLY" : "DRY RUN (nothing is written; add --apply to import)"}`);
  console.log(`Target: ${url}\nSource: ${dir}\n`);

  // Uploader: must be an existing administrator.
  const { data: adminId, error: adminLookupError } = await supabase.rpc("auth_user_id_by_email", { p_email: adminEmail.data });
  if (adminLookupError) fail(`Could not query users (${adminLookupError.code}).`);
  const { data: adminProfile } = adminId
    ? await supabase.from("profiles").select("id, role").eq("id", adminId).maybeSingle()
    : { data: null };
  if (adminProfile?.role !== "admin") fail(`${adminEmail.data} is not an administrator.`);

  const review: ReviewRow[] = [];
  const log: LogRow[] = [];
  const accounts = scan(dir, review);
  const stats = { accountsCreated: 0, accountsExisting: 0, accountsSkipped: 0, filesImported: 0, filesDuplicate: 0, filesRejected: 0, bytes: 0 };

  // ---- Categories ----------------------------------------------------------
  const { data: existingCategories, error: catError } = await supabase.from("file_categories").select("id, name_en, is_archived");
  if (catError) fail(`Could not read categories (${catError.code}).`);
  const categoryIds = new Map<CategoryKey, string>();
  for (const [key, names] of Object.entries(CATEGORIES) as [CategoryKey, (typeof CATEGORIES)[CategoryKey]][]) {
    const found = existingCategories.find((c) => c.name_en === names.name_en);
    if (found) {
      categoryIds.set(key, found.id);
      if (found.is_archived && apply) await supabase.from("file_categories").update({ is_archived: false }).eq("id", found.id);
      continue;
    }
    console.log(`• Category to create: ${names.name_en} / ${names.name_es}`);
    if (!apply) continue;
    const { data, error } = await supabase.from("file_categories").insert({ name_en: names.name_en, name_es: names.name_es }).select("id").single();
    if (error || !data) fail(`Could not create category ${names.name_en} (${error?.code ?? "unknown"}).`);
    categoryIds.set(key, data.id);
  }
  for (const example of existingCategories.filter((c) => EXAMPLE_CATEGORIES.includes(c.name_en))) {
    const { count } = await supabase.from("files").select("id", { count: "exact", head: true }).eq("category_id", example.id);
    if (count) {
      // Deleting would silently uncategorize real files: archive instead.
      console.log(`• Example category "${example.name_en}" is used by ${count} file(s): it will be archived, not deleted.`);
      review.push({ issue: "example_category_in_use", folder: "", email: "", detail: `${example.name_en}: ${count} file(s), archived` });
      if (apply) await supabase.from("file_categories").update({ is_archived: true }).eq("id", example.id);
    } else {
      console.log(`• Example category to delete: ${example.name_en}`);
      if (apply) {
        const { error } = await supabase.from("file_categories").delete().eq("id", example.id);
        if (error) fail(`Could not delete category ${example.name_en} (${error.code}).`);
      }
    }
  }

  // ---- Accounts and files --------------------------------------------------
  const audits: Database["public"]["Tables"]["audit_logs"]["Insert"][] = [];
  const flushAudits = async () => {
    if (!apply || audits.length === 0) return;
    const { error } = await supabase.from("audit_logs").insert(audits.splice(0));
    if (error) console.error(`  ! audit insert failed (${error.code})`);
  };

  let n = 0;
  for (const account of accounts) {
    n++;
    const name = fullName(account);
    const tag = `[${n}/${accounts.length}] ${account.email}`;

    let userId: string | null = null;
    const { data: existingId, error: lookupError } = await supabase.rpc("auth_user_id_by_email", { p_email: account.email });
    if (lookupError) fail(`Could not query users (${lookupError.code}).`);

    if (existingId) {
      const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", existingId).maybeSingle();
      if (profile?.role !== "user" || !profile.is_active) {
        stats.accountsSkipped++;
        review.push({
          issue: profile?.role === "admin" ? "email_is_admin" : "existing_account_inactive",
          folder: account.folders.join(" | "),
          email: account.email,
          detail: `${account.pdfs.length} PDF(s) not imported`,
        });
        continue;
      }
      userId = existingId;
      stats.accountsExisting++;
    } else {
      stats.accountsCreated++;
      if (apply) {
        // No password and unconfirmed: no email is sent, the invitation stays
        // pending and can be (re)sent later from the admin panel.
        const { data, error } = await supabase.auth.admin.createUser({
          email: account.email,
          email_confirm: false,
          user_metadata: { full_name: name, preferred_locale: LOCALE },
        });
        if (error || !data.user) {
          stats.accountsCreated--;
          stats.accountsSkipped++;
          review.push({ issue: "create_user_failed", folder: account.folders.join(" | "), email: account.email, detail: error?.code ?? "unknown" });
          continue;
        }
        userId = data.user.id;
        const { error: profileError } = await supabase.from("profiles").update({ can_upload: true }).eq("id", userId);
        if (profileError) review.push({ issue: "grant_upload_failed", folder: account.folders.join(" | "), email: account.email, detail: profileError.code });
        audits.push({
          actor_id: adminId,
          action: "user.imported",
          target_type: "user",
          target_id: userId,
          metadata: { source: SOURCE, locale: LOCALE, folders: account.folders.length },
        });
      }
    }

    // Files already stored for this owner, by checksum (re-runs and "(2)" copies).
    const known = new Set<string>();
    if (userId) {
      const { data: rows } = await supabase.from("files").select("checksum_sha256").eq("owner_id", userId).is("deleted_at", null);
      for (const r of rows ?? []) known.add(r.checksum_sha256);
    }
    let usage = { used: 0, quota: Infinity };
    if (userId) {
      const { data } = await supabase.rpc("storage_usage", { p_owner: userId }).single();
      if (data) usage = { used: data.used_bytes + data.pending_bytes, quota: data.quota_bytes };
    }

    let imported = 0;
    for (const pdf of account.pdfs) {
      const { years, label } = parseDocName(pdf.name);
      const key = label ? categorize(label) : "supporting";
      const row: LogRow = { email: account.email, folder: pdf.folder, file: pdf.name, category: CATEGORIES[key].name_en, status: "", detail: "" };
      log.push(row);
      const reject = (detail: string) => {
        row.status = "rejected";
        row.detail = detail;
        stats.filesRejected++;
        review.push({ issue: "file_rejected", folder: pdf.folder, email: account.email, detail: `${pdf.name}: ${detail}` });
      };

      const nameCheck = checkFileName(pdf.name);
      if (!nameCheck.ok || nameCheck.kind !== "pdf") {
        reject(nameCheck.ok ? "not_pdf" : nameCheck.reason);
        continue;
      }
      const buf = new Uint8Array(fs.readFileSync(pdf.fullPath));
      if (buf.byteLength === 0) {
        reject("empty");
        continue;
      }
      if (buf.byteLength > MAX_FILE_BYTES) {
        reject("too_large");
        continue;
      }
      const inspection = inspectFile(buf, "pdf");
      if (!inspection.ok) {
        reject(inspection.reason);
        continue;
      }
      const checksum = sha256Hex(buf);
      if (known.has(checksum)) {
        row.status = "duplicate";
        row.detail = "same content already stored for this account";
        stats.filesDuplicate++;
        continue;
      }
      if (usage.used + buf.byteLength > usage.quota) {
        reject("quota_exceeded");
        continue;
      }
      known.add(checksum);
      usage.used += buf.byteLength;

      const description = [years, label].filter(Boolean).join(" · ").slice(0, MAX_DESCRIPTION_LENGTH) || null;
      if (!apply || !userId) {
        row.status = "would_import";
        stats.filesImported++;
        stats.bytes += buf.byteLength;
        continue;
      }

      const storagePath = `${userId}/${crypto.randomUUID()}`;
      const { error: uploadError } = await storage.upload(storagePath, buf, { contentType: nameCheck.mime, upsert: false });
      if (uploadError) {
        known.delete(checksum);
        reject(`upload_failed: ${uploadError.message}`);
        continue;
      }
      const { data: file, error: insertError } = await supabase
        .from("files")
        .insert({
          owner_id: userId,
          uploaded_by: adminId,
          category_id: categoryIds.get(key) ?? null,
          original_name: pdf.name.normalize("NFC"),
          description,
          storage_path: storagePath,
          mime_type: nameCheck.mime,
          size_bytes: buf.byteLength,
          checksum_sha256: checksum,
        })
        .select("id")
        .single();
      if (insertError || !file) {
        await storage.remove([storagePath]);
        known.delete(checksum);
        reject(`insert_failed: ${insertError?.code ?? "unknown"}`);
        continue;
      }
      row.status = "imported";
      row.detail = file.id;
      stats.filesImported++;
      stats.bytes += buf.byteLength;
      imported++;
      audits.push({
        actor_id: adminId,
        action: "file.uploaded",
        target_type: "file",
        target_id: file.id,
        metadata: { owner_id: userId, original_name: pdf.name, mime_type: nameCheck.mime, size_bytes: buf.byteLength, on_behalf: true, source: SOURCE },
      });
    }

    console.log(`${tag}  ${existingId ? "existing" : "new"}  ${imported || account.pdfs.length} PDF(s)`);
    if (audits.length >= 100) await flushAudits();
  }
  await flushAudits();

  const issues = review.reduce<Record<string, number>>((acc, r) => ((acc[r.issue] = (acc[r.issue] ?? 0) + 1), acc), {});
  const summary = [
    `${apply ? "APPLY" : "DRY RUN"} — ${new Date().toISOString()}`,
    `Target: ${url}`,
    `Source: ${dir}`,
    "",
    `Accounts: ${accounts.length} (new ${stats.accountsCreated}, existing ${stats.accountsExisting}, skipped ${stats.accountsSkipped})`,
    `Files ${apply ? "imported" : "to import"}: ${stats.filesImported} (${(stats.bytes / 1024 / 1024).toFixed(1)} MB)`,
    `Files skipped as duplicates: ${stats.filesDuplicate}`,
    `Files rejected: ${stats.filesRejected}`,
    "",
    "Review items:",
    ...Object.entries(issues).map(([k, v]) => `  ${k}: ${v}`),
  ];
  writeReport(reportDir, review, log, summary);
  console.log(`\n${summary.join("\n")}\n\nReport: ${reportDir}`);
}

main().catch((error: unknown) => fail(`Unexpected error${error instanceof Error ? `: ${error.message}` : "."}`));
