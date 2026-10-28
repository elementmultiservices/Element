import { apiError, authFailure } from "@/lib/api";
import { authorize } from "@/lib/auth/session";
import { getIntakeSubmission } from "@/lib/intake/queries";
import { redirectToIntakeObject } from "@/lib/intake/storage";
import { createClient } from "@/lib/supabase/server";

/** Face photo taken when the form was signed, for its owner or an administrator. */
export async function GET(_request: Request, { params }: RouteContext<"/api/intake/submissions/[id]/photo">) {
  const auth = await authorize();
  if (!auth.ok) return authFailure(auth.reason);
  const { id } = await params;
  const found = await getIntakeSubmission(await createClient(), id);
  if (!found?.submission.face_photo_path) return apiError("not_found", 404);
  return redirectToIntakeObject(found.submission.face_photo_path);
}
