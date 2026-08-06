import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip Next internals and static public assets (including POD sample PDFs).
     * Without .pdf here, /pod-samples/*.pdf is treated as an app route and
     * role-guarded away from the actual file.
     */
    "/((?!_next/static|_next/image|favicon.ico|pod-samples/|pod-uploads/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|ico)$).*)",
  ],
};
