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

export function parseJsonResponse<T>(schema: v.GenericSchema<unknown, T>, text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  return v.parse(schema, parsed);
}

export async function polishTranscript(rawText: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下は音声認識で得られた日本語の書き起こしテキストです。誤認識や言い淀み、繰り返しを修正し、自然で読みやすい文章に整えてください。内容は変えずに表現だけ改善してください。修正後のテキストのみを返してください。\n\n${rawText}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  const text = block?.type === "text" ? block.text.trim() : "";
  return text !== "" ? text : rawText;
}
