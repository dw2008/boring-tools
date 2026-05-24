import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  response.headers.set("X-Content-Type-Options", "nosniff");
  // CSP frame-ancestors supersedes X-Frame-Options in Chrome and supports multiple origins.
  // accounts.google.com needs to frame the root URL for Google Sign-In's relay iframe.
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://accounts.google.com"
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
