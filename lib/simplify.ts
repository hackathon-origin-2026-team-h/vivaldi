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

const SYSTEM_PROMPT = `専門用語・難しい言葉を小学生でもわかる言葉に言い換えてください。元の文章の意味・ニュアンスを変えないこと。専門用語と平易化した説明のペアも抽出してください。以下のJSON形式のみで返してください（マークダウン・前置きテキスト不要）:
{"simplified": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "平易化された説明"}]}`;

export async function simplify(text: string): Promise<SimplifiedResult> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const parsed = parseJsonResponse(SimplifyResponseSchema, extractText(message));

  return {
    original: text,
    simplified: parsed.simplified,
    terms: parsed.terms,
  };
}
