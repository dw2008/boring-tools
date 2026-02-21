import { NextResponse } from "next/server";
import { z } from "zod";
import { proofreadText } from "@/lib/ai/client";
import type { ProofreadResponse } from "@/lib/types";

const requestSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(10_000, "Text must be 10,000 characters or fewer"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { text } = parsed.data;
    const fixed = await proofreadText(text);
    const hasChanges = text !== fixed;

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
