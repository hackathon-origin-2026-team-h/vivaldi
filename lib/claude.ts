import Anthropic from "@anthropic-ai/sdk";
import * as v from "valibot";

const globalForClaude = globalThis as unknown as { _claude: Anthropic | undefined };

/**
 * Claudeクライアントを返す。初回呼び出し時にインスタンスを生成してキャッシュする。
 * ANTHROPIC_API_KEY が未設定の場合はエラーをthrowする。
 */
export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  if (!globalForClaude._claude) {
    globalForClaude._claude = new Anthropic({ apiKey });
  }
  return globalForClaude._claude;
}

/**
 * Claudeのテキストレスポンス（マークダウンコードブロック含む）をJSONとしてパースし、
 * valibotスキーマで検証して返す。
 */
export function parseJsonResponse<TOutput>(
  schema: v.BaseSchema<unknown, TOutput, v.BaseIssue<unknown>>,
  text: string,
): TOutput {
  const jsonText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return v.parse(schema, JSON.parse(jsonText));
}
