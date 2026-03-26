import * as v from "valibot";
import { extractText, getClient, parseJsonResponse } from "@/lib/claude";

const PolishResponseSchema = v.object({ result: v.string() });

export async function polishTranscript(rawText: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下は音声認識で得られた日本語の書き起こしテキストです。誤認識や言い淀み、繰り返しを修正し、自然で読みやすい文章に整えてください。内容は変えずに表現だけ改善してください。以下のJSON形式のみで返してください（前置きテキスト不要）:\n{"result": "修正後のテキスト"}\n\n${rawText}`,
      },
    ],
  });

  try {
    const raw = extractText(response);
    const parsed = parseJsonResponse(PolishResponseSchema, raw);
    return parsed.result;
  } catch {
    return rawText;
  }
}
