import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { PROOFREAD_SYSTEM_PROMPT } from "./prompts/proofread";

export async function proofreadText(text: string): Promise<string> {
  const { text: fixed } = await generateText({
    model: openai("gpt-4.1-mini"),
    system: PROOFREAD_SYSTEM_PROMPT,
    prompt: text,
  });

  return fixed;
}
