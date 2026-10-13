import type { NextRequest } from "next/server";
import { redirectToFile } from "@/lib/files/serve";

/** Opens a PDF or image inline in the browser (see redirectToFile for the checks). */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/files/[id]/preview">) {
  const { id } = await params;
  return redirectToFile(id, "preview");
}
