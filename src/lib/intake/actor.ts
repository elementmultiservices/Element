import "server-only";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { apiError, authFailure } from "@/lib/api";
import { authorize } from "@/lib/auth/session";
import { checkDraftToken } from "@/lib/security/form-token";

/** Header the public intake form sends with its draft token on every call. */
export const DRAFT_HEADER = "x-intake-draft";

/**
 * Who is filling out an intake form: a signed-in client (the form is theirs) or
 * an anonymous visitor of the public form, known only by the draft id of the
 * signed token issued with the page. `fast` marks a draft younger than the time
 * trap; only the final submission cares.
 */
export type IntakeActor = { kind: "user"; userId: string } | { kind: "draft"; draftId: string; fast: boolean };

export async function intakeActor(request: NextRequest): Promise<{ actor: IntakeActor } | { response: NextResponse }> {
  const token = request.headers.get(DRAFT_HEADER);
  if (token !== null) {
    const check = await checkDraftToken(token);
    if (check.status === "expired") return { response: apiError("form_expired", 410) };
    if (!check.draftId || check.status === "invalid") return { response: apiError("forbidden", 403) };
    return { actor: { kind: "draft", draftId: check.draftId, fast: check.status === "tooFast" } };
  }

  const auth = await authorize();
  if (!auth.ok) return { response: authFailure(auth.reason) };
  if (auth.ctx.role !== "user") return { response: apiError("forbidden", 403) };
  return { actor: { kind: "user", userId: auth.ctx.userId } };
}

/** Column and value that select the actor's own pending uploads. */
export function actorColumn(actor: IntakeActor): ["owner_id" | "draft_id", string] {
  return actor.kind === "user" ? ["owner_id", actor.userId] : ["draft_id", actor.draftId];
}

/** Storage folder of the actor's objects (inside the private intake bucket). */
export function actorFolder(actor: IntakeActor): string {
  return actor.kind === "user" ? `intake/${actor.userId}` : `intake/drafts/${actor.draftId}`;
}

/** Audit actor id (anonymous visitors have none). */
export function actorId(actor: IntakeActor): string | null {
  return actor.kind === "user" ? actor.userId : null;
}
