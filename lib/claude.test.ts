import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { getClient, parseJsonResponse } from "./claude";

describe("getClient", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // グローバルキャッシュをリセット
    (globalThis as Record<string, unknown>)._claude = undefined;
  });

  it("クライアントインスタンスを返す", () => {
    const client = getClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
  });

  it("ANTHROPIC_API_KEYが未設定の場合エラーをthrowする", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getClient()).toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("複数回呼び出しても同じインスタンスを返す", () => {
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
  });
});

describe("parseJsonResponse", () => {
  const schema = v.object({
    name: v.string(),
    count: v.number(),
  });

  it("正常なJSONをパースしてスキーマで検証する", () => {
    const result = parseJsonResponse(schema, '{"name": "テスト", "count": 3}');
    expect(result).toEqual({ name: "テスト", count: 3 });
  });

  it("マークダウンコードブロック（```json）を除去してパースする", () => {
    const result = parseJsonResponse(schema, '```json\n{"name": "テスト", "count": 3}\n```');
    expect(result).toEqual({ name: "テスト", count: 3 });
  });

  it("マークダウンコードブロック（```のみ）を除去してパースする", () => {
    const result = parseJsonResponse(schema, '```\n{"name": "テスト", "count": 3}\n```');
    expect(result).toEqual({ name: "テスト", count: 3 });
  });

  it("不正なJSONの場合SyntaxErrorをthrowする", () => {
    expect(() => parseJsonResponse(schema, "not json")).toThrow(SyntaxError);
  });

  it("JSONの構造がスキーマに違反する場合エラーをthrowする", () => {
    expect(() => parseJsonResponse(schema, '{"name": 123, "count": 3}')).toThrow();
  });

  it("必須フィールドが欠けている場合エラーをthrowする", () => {
    expect(() => parseJsonResponse(schema, '{"name": "テスト"}')).toThrow();
  });
});
