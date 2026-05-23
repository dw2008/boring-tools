import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS } from "@/lib/stripe/plans";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sign in to play chess." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_tier, current_period_start")
    .eq("id", user.id)
    .single();

  const userPlan = profile?.subscription_tier ?? "free";
  const limit = PLAN_LIMITS["chess"]?.[userPlan] ?? PLAN_LIMITS["chess"].free;

  if (limit !== Infinity) {
    const periodStart = new Date();
    if (userPlan !== "free" && profile?.current_period_start) {
      periodStart.setTime(new Date(profile.current_period_start).getTime());
    } else {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    const { count, error: usageError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "chess")
      .gte("created_at", periodStart.toISOString());

    if (usageError) {
      return NextResponse.json(
        { error: "Failed to check usage. Please try again." },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `You've used all ${limit} game${limit === 1 ? "" : "s"} this month. Upgrade for more.`,
          code: "LIMIT_REACHED",
          limit,
          used: count,
        },
        { status: 403 }
      );
    }
  }

  const { error: insertError } = await admin.from("tool_usage").insert({
    user_id: user.id,
    tool: "chess",
  });

  if (insertError) {
    console.error("Chess usage insert error:", insertError);
  }

  return NextResponse.json({ ok: true });
}
