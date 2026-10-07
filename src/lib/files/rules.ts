/**
 * File rules shared by the browser (early feedback) and the server (enforcement).
 * The server is always authoritative; client checks only improve UX.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB
export const DAILY_UPLOAD_CAP = 50;
export const MAX_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 1000;

export const FILE_TYPES = {
  pdf: { mime: "application/pdf", label: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "DOCX" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "XLSX" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PPTX" },
  jpg: { mime: "image/jpeg", label: "JPG" },
  png: { mime: "image/png", label: "PNG" },
} as const;

export type FileKind = keyof typeof FILE_TYPES;
export const FILE_KINDS = Object.keys(FILE_TYPES) as FileKind[];
export type AllowedMime = (typeof FILE_TYPES)[FileKind]["mime"];

const EXTENSION_ALIASES: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
};

/** Extensions that must never appear anywhere in a file name (e.g. "invoice.exe.pdf"). */
const DANGEROUS_SEGMENTS = new Set([
  "exe", "dll", "com", "bat", "cmd", "msi", "msp", "scr", "pif", "cpl", "jar", "js", "jse", "mjs", "vbs", "vbe",
  "wsf", "wsh", "ps1", "psm1", "sh", "bash", "zsh", "php", "phtml", "phar", "py", "pl", "rb", "cgi", "asp", "aspx",
  "jsp", "html", "htm", "xhtml", "svg", "hta", "lnk", "reg", "app", "apk", "dmg", "iso", "docm", "xlsm", "pptm",
  "dotm", "xltm", "potm", "ppsm", "zip", "rar", "7z", "gz", "tar",
]);

export function kindFromMime(mime: string): FileKind | null {
  for (const kind of FILE_KINDS) if (FILE_TYPES[kind].mime === mime) return kind;
  return null;
}

export type NameCheck =
  | { ok: true; kind: FileKind; mime: AllowedMime }
  | { ok: false; reason: "invalidName" | "doubleExtension" | "typeNotAllowed" };

/**
 * Validates a client-supplied file name: exactly one allowed extension, no
 * executable or archive segments, no control characters or path separators.
 */
export function checkFileName(rawName: string): NameCheck {
  const name = rawName.normalize("NFC");
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return { ok: false, reason: "invalidName" };
  if (/[\u0000-\u001f\u007f\\/]/.test(name)) return { ok: false, reason: "invalidName" };
  if (/[\s.]$/.test(name)) return { ok: false, reason: "invalidName" };

  const segments = name.split(".");
  if (segments.length < 2 || segments[0]!.trim() === "") return { ok: false, reason: "typeNotAllowed" };

  const ext = segments[segments.length - 1]!.toLowerCase();
  const kind = EXTENSION_ALIASES[ext];
  if (!kind) return { ok: false, reason: "typeNotAllowed" };

  for (const segment of segments.slice(1, -1)) {
    const s = segment.trim().toLowerCase();
    if (DANGEROUS_SEGMENTS.has(s) || s in EXTENSION_ALIASES) return { ok: false, reason: "doubleExtension" };
  }
  return { ok: true, kind, mime: FILE_TYPES[kind].mime };
}

/**
 * Display-safe version of a stored original name: strips control and bidi
 * override characters (used to disguise extensions) and collapses whitespace.
 */
export function sanitizeDisplayName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩‎‏]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Name used in the Content-Disposition of downloads: display-safe, without
 * quotes, separators or characters that could break or inject header values.
 */
export function sanitizeDownloadName(name: string): string {
  const cleaned = sanitizeDisplayName(name).replace(/["\\/:*?<>|;=,%]/g, "_");
  return cleaned.length > 0 ? cleaned : "file";
}
