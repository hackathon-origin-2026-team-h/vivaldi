import * as v from "valibot";
import { extractText, getClient, parseJsonResponse } from "@/lib/claude";

const SimplifyResponseSchema = v.object({
  simplified: v.string(),
  terms: v.array(
    v.object({
      word: v.string(),
      explanation: v.string(),
    }),
  ),
});

export type Term = {
  word: string;
  explanation: string;
};

export type SimplifiedResult = {
  original: string;
  simplified: string;
  terms: Term[];
};

const SYSTEM_PROMPT = `あなたは文章を平易化するアシスタントです。
以下のJSON形式のみで返してください。余分なテキスト不要。

{"simplified": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "わかりやすい説明"}]}

ルール:
- 専門用語を小学生でもわかる言葉に言い換える
- 意味を変えない
- 専門用語がなければtermsは空配列`;

export async function simplify(text: string): Promise<SimplifiedResult> {
  const start = Date.now();

  const stream = getClient().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const message = await stream.finalMessage();
  console.log(`[simplify] ${Date.now() - start}ms`);

  const raw = extractText(message);
  if (!raw) return { original: text, simplified: text, terms: [] };
  const parsed = parseJsonResponse(SimplifyResponseSchema, raw);

  return {
    original: text,
    simplified: parsed.simplified,
    terms: parsed.terms,
  };
}
