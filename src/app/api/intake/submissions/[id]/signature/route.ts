import type { NextRequest } from "next/server";
import { apiError, authFailure } from "@/lib/api";
import { authorize } from "@/lib/auth/session";
import { getIntakeSubmission } from "@/lib/intake/queries";
import { redirectToIntakeObject } from "@/lib/intake/storage";
import { createClient } from "@/lib/supabase/server";

/** Signature image of a submission (?who=spouse for the spouse's), for its owner or an administrator. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/intake/submissions/[id]/signature">) {
  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { id } = await params;
  const found = await getIntakeSubmission(await createClient(), id);
  if (!found) return apiError("not_found", 404);
  const path = request.nextUrl.searchParams.get("who") === "spouse" ? found.submission.spouse_signature_path : found.submission.signature_path;
  if (!path) return apiError("not_found", 404);
  return redirectToIntakeObject(path);
}
