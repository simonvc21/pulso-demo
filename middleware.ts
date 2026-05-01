import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image, favicon, public assets
     * - /fill/[id]   (founder-facing forms)
     * - /share/[token]  (LP-facing letters)
     * - /auth/*  (auth callback)
     * - /login   (login page itself)
     * - /api/*   (API routes handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|fill|share|auth|login|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
