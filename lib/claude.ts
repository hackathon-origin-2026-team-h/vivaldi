import Anthropic from "@anthropic-ai/sdk";
import * as v from "valibot";

const globalForClaude = globalThis as unknown as { _claude?: Anthropic };

export function getClient(): Anthropic {
  if (!globalForClaude._claude) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    globalForClaude._claude = new Anthropic({ apiKey });
  }
  return globalForClaude._claude;
}

export function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "";
}

export function parseJsonResponse<T>(schema: v.GenericSchema<unknown, T>, text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  return v.parse(schema, parsed);
}
