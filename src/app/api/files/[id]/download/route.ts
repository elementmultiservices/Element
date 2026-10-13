import type { NextRequest } from "next/server";
import { redirectToFile } from "@/lib/files/serve";

/** Downloads the file as an attachment (see redirectToFile for the checks). */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/files/[id]/download">) {
  const { id } = await params;
  return redirectToFile(id, "download");
}
