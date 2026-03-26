import * as v from "valibot";
import {
  BASE_SYSTEM_PROMPT,
  extractText,
  getClient,
  parseJsonResponse,
} from "@/lib/claude";

const PolishResponseSchema = v.object({ result: v.string() });

const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

## タスク
音声認識で得られた書き起こしテキストの誤認識・言い淀み・繰り返しを修正し、自然で読みやすい文章に整えてください。

## 言い淀みの定義
以下のような発話における間投詞・フィラーを「言い淀み」とする:
- 「えっと」「えー」「ええと」
- 「あの、」「あのー」「あのう」
- 「うーん」「うん、」（文頭や文中で間を埋める用途）
- 「まあ、」「まあ」（内容に関与しない場合）
- 「そのー」「そのう」
- 「なんか、」（内容に関与しない場合）
単語として意味を持つ「まあ（程度を表す）」「うん（同意）」などは除去しないこと。

以下のJSON形式のみで返してください（前置きテキスト不要）:
{"result": "修正後のテキスト"}`;

export async function polishTranscript(rawText: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText }],
  });

  try {
    const raw = extractText(response);
    const parsed = parseJsonResponse(PolishResponseSchema, raw);
    return parsed.result;
  } catch {
    return rawText;
  }
}
