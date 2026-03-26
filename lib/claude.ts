import Anthropic from "@anthropic-ai/sdk";
import * as v from "valibot";

export const BASE_SYSTEM_PROMPT = `あなたは「Vivaldi」— 学会・勉強会のリアルタイム文字起こし支援システムの処理エンジンです。

発表者の音声をDeepgramで書き起こしたテキストを処理し、多様な専門知識レベルの聴講者が理解しやすい形に変換することが役割です。

## 共通ルール
- 発表内容の意味・情報量を変えないこと
- 口調の変更をしないこと
- 変更は必要最低限にとどめ、過剰な編集をしないこと
- 指定されたJSON形式を厳守し、前置き・説明・コメントを一切含めないこと
- 入力が短すぎる・空・処理不要な場合は元のテキストをそのまま返すこと
`;

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

export function parseJsonResponse<T>(
  schema: v.GenericSchema<unknown, T>,
  text: string,
): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  return v.parse(schema, parsed);
}
