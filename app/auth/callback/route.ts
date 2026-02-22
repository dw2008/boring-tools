import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;

  if (error) {
    console.error("Auth error:", error, errorDescription);
    return NextResponse.redirect(
      `${origin}/proofread?auth_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error("Session exchange error:", sessionError);
        return NextResponse.redirect(
          `${origin}/proofread?auth_error=${encodeURIComponent(sessionError.message)}`
        );
      }
    } catch (err) {
      console.error("Unexpected error during auth callback:", err);
      return NextResponse.redirect(
        `${origin}/proofread?auth_error=Authentication%20failed`
      );
    }
  }

  return NextResponse.redirect(`${origin}/proofread`);
}
