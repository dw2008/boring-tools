import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { digitizeImage } from "@/lib/tools/notes/ai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS } from "@/lib/stripe/plans";
import type { DigitizeResponse, Note } from "@/lib/tools/notes/types";

const RATE_LIMIT_PER_MINUTE = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    // 1. Parse multipart form
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data with an image." },
        { status: 400 },
      );
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required." },
        { status: 400 },
      );
    }

    if (!ACCEPTED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Image must be JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 10MB or smaller." },
        { status: 400 },
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to digitize notes." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    // 3. Rate limiting — max requests per minute
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "notes")
      .gte("created_at", oneMinuteAgo);

    if (rateError) {
      console.error("Rate limit check error:", rateError);
      return NextResponse.json(
        { error: "Failed to check rate limit. Please try again." },
        { status: 500 },
      );
    }

    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429 },
      );
    }

    // 4. Look up plan + monthly usage
    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_tier, current_period_start")
      .eq("id", user.id)
      .single();

    const userPlan = profile?.subscription_tier ?? "free";
    const limit = PLAN_LIMITS["notes"]?.[userPlan] ?? PLAN_LIMITS["notes"].free;

    const periodStart = new Date();
    if (userPlan !== "free" && profile?.current_period_start) {
      periodStart.setTime(new Date(profile.current_period_start).getTime());
    } else {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    const { count: monthlyCount, error: usageError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "notes")
      .gte("created_at", periodStart.toISOString());

    if (usageError) {
      console.error("Usage check error:", usageError);
      return NextResponse.json(
        { error: "Failed to check usage. Please try again." },
        { status: 500 },
      );
    }

    if ((monthlyCount ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `You've reached your monthly limit of ${limit} note digitizations. Upgrade your plan for more.`,
          code: "LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    // 5. Run vision extraction
    const buffer = Buffer.from(await file.arrayBuffer());
    const { title, markdown, figures } = await digitizeImage(buffer, file.type);

    // 6. Record usage
    const { error: insertError } = await admin.from("tool_usage").insert({
      user_id: user.id,
      tool: "notes",
    });

    if (insertError) {
      console.error("Usage insert error:", insertError);
    }

    const note: Note = {
      id: randomUUID(),
      title,
      markdown,
      figures,
      createdAt: new Date().toISOString(),
    };

    const response: DigitizeResponse = { note };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Notes API error:", err);
    return NextResponse.json(
      { error: "Failed to digitize image. Please try again." },
      { status: 500 },
    );
  }
}
