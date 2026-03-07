import { NextResponse } from "next/server";
import { z } from "zod";
import { proofreadText } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProofreadResponse } from "@/lib/types";

const requestSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(10_000, "Text must be 10,000 characters or fewer"),
});

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  basic: 200,
  pro: Infinity,
};

const RATE_LIMIT_PER_MINUTE = 20;

export async function POST(request: Request) {
  try {
    // 1. Parse + validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
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
        { error: "Sign in to use the proofreader." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 3. Rate limiting — max requests per minute
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "proofread")
      .gte("created_at", oneMinuteAgo);

    if (rateError) {
      console.error("Rate limit check error:", rateError);
      return NextResponse.json(
        { error: "Failed to check rate limit. Please try again." },
        { status: 500 }
      );
    }

    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429 }
      );
    }

    // 4. Check monthly usage against plan limit
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount, error: usageError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "proofread")
      .gte("created_at", startOfMonth.toISOString());

    if (usageError) {
      console.error("Usage check error:", usageError);
      return NextResponse.json(
        { error: "Failed to check usage. Please try again." },
        { status: 500 }
      );
    }

    // TODO: Look up user's actual plan from a profiles/subscriptions table
    const userPlan = "free";
    const limit = PLAN_LIMITS[userPlan] ?? PLAN_LIMITS.free;

    if ((monthlyCount ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `You've reached your monthly limit of ${limit} proofreads. Upgrade your plan for more.`,
          code: "LIMIT_REACHED",
        },
        { status: 403 }
      );
    }

    // 5. Call proofread AI
    const { text } = parsed.data;
    const fixed = await proofreadText(text);
    const hasChanges = text !== fixed;

    // 6. Record usage
    const { error: insertError } = await admin.from("tool_usage").insert({
      user_id: user.id,
      tool: "proofread",
    });

    if (insertError) {
      console.error("Usage insert error:", insertError);
      // Non-fatal — still return the result
    }

    const response: ProofreadResponse = {
      original: text,
      fixed,
      hasChanges,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Proofread API error:", err);
    return NextResponse.json(
      { error: "Failed to proofread text. Please try again." },
      { status: 500 }
    );
  }
}
