import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    console.error("Auth error:", error, errorDescription);
    redirect(
      `/proofread?auth_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error("Session exchange error:", sessionError);
        redirect(
          `/proofread?auth_error=${encodeURIComponent(sessionError.message)}`
        );
      }
    } catch (err) {
      // redirect() throws internally — rethrow it
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      console.error("Unexpected error during auth callback:", err);
      redirect("/proofread?auth_error=Authentication%20failed");
    }
  }

  redirect("/proofread");
}
