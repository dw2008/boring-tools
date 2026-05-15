import { streamText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS } from "@/lib/stripe/plans";
import { PROBLEMS } from "@/lib/tools/interview/problems";
import { buildSystemPrompt } from "@/lib/tools/interview/prompts";
import type { UmpireStep } from "@/lib/tools/interview/types";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      parts: z.array(z.any()),
    }).passthrough()
  ),
  problemId: z.string(),
  currentStep: z.enum([
    "understand",
    "match",
    "plan",
    "implement",
    "review",
    "evaluate",
  ]),
  code: z.string().optional(),
  customDescription: z.string().optional(),
  sessionId: z.string(),
  recordUsage: z.boolean().optional(),
});

const RATE_LIMIT_PER_MINUTE = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0].message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, problemId, currentStep, code, customDescription, recordUsage } = parsed.data;

    // Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sign in to use interview prep." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const admin = createAdminClient();

    // Rate limiting
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await admin
      .from("tool_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tool", "interview")
      .gte("created_at", oneMinuteAgo);

    if (rateError) {
      return new Response(
        JSON.stringify({ error: "Failed to check rate limit." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Plan limit check — only when recording usage (first message of session)
    if (recordUsage) {
      const { data: profile } = await admin
        .from("profiles")
        .select("subscription_tier, current_period_start")
        .eq("id", user.id)
        .single();

      const userPlan = profile?.subscription_tier ?? "free";
      const limit =
        PLAN_LIMITS["interview"]?.[userPlan] ??
        PLAN_LIMITS["interview"].free;

      const periodStart = new Date();
      if (userPlan !== "free" && profile?.current_period_start) {
        periodStart.setTime(
          new Date(profile.current_period_start).getTime()
        );
      } else {
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
      }

      const { count: monthlyCount, error: usageError } = await admin
        .from("tool_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("tool", "interview")
        .gte("created_at", periodStart.toISOString());

      if (usageError) {
        return new Response(
          JSON.stringify({ error: "Failed to check usage." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      if ((monthlyCount ?? 0) >= limit) {
        return new Response(
          JSON.stringify({
            error: `You've reached your monthly limit of ${limit} interview sessions. Upgrade your plan for more.`,
            code: "LIMIT_REACHED",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      // Record usage
      await admin.from("tool_usage").insert({
        user_id: user.id,
        tool: "interview",
      });
    }

    // Find problem — built-in or custom
    let problem: import("@/lib/tools/interview/types").Problem;

    if (problemId === "custom" && customDescription) {
      problem = {
        id: "custom",
        title: "Custom Problem",
        description: customDescription,
        difficulty: "medium",
        topics: [],
        constraints: [],
        examples: [],
        hints: [],
        optimalComplexity: { time: "N/A", space: "N/A" },
        solutionApproach: "",
      };
    } else {
      const found = PROBLEMS.find((p) => p.id === problemId);
      if (!found) {
        return new Response(
          JSON.stringify({ error: "Problem not found." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      problem = found;
    }

    const systemPrompt = buildSystemPrompt(
      problem,
      currentStep as UmpireStep,
      code
    );

    // Convert UIMessages to core model messages for streamText
    const coreMessages = await convertToModelMessages(messages);

    // Inject the editor code into the last user message so the AI clearly sees it
    const editorSteps = ["implement", "review", "evaluate"];
    if (code && editorSteps.includes(currentStep) && coreMessages.length > 0) {
      const last = coreMessages[coreMessages.length - 1];
      if (last.role === "user" && Array.isArray(last.content)) {
        last.content.push({
          type: "text",
          text: `\n\n[Code from editor]\n\`\`\`python\n${code}\n\`\`\``,
        });
      } else if (last.role === "user" && typeof last.content === "string") {
        last.content += `\n\n[Code from editor]\n\`\`\`python\n${code}\n\`\`\``;
      }
    }

    const result = streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages: coreMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("Interview chat API error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
