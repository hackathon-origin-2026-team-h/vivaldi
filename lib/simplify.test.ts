import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { simplify } from "./simplify";

const VALID_JSON = JSON.stringify({
  simplified: "やさしい文章",
  terms: [{ word: "専門用語", explanation: "わかりやすい説明" }],
});

describe("simplify", () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    (globalThis as Record<string, unknown>)._claude = undefined;
  });

  it("正常なJSONレスポンスをパースして返す", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: VALID_JSON }],
    });

    const result = await simplify("難しいテキスト");

    expect(result.original).toBe("難しいテキスト");
    expect(result.simplified).toBe("やさしい文章");
    expect(result.terms).toEqual([{ word: "専門用語", explanation: "わかりやすい説明" }]);
  });

  it("マークダウンコードブロックで囲まれたJSONも正しくパースする", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + VALID_JSON + "\n```" }],
    });

    const result = await simplify("難しいテキスト");

    expect(result.simplified).toBe("やさしい文章");
  });

  it("ANTHROPIC_API_KEYが未設定の場合エラーをthrowする", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(simplify("テスト")).rejects.toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("不正なJSONの場合エラーをthrowする", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "not json" }],
    });

    await expect(simplify("テスト")).rejects.toThrow(SyntaxError);
  });

  it("JSONの構造がスキーマに違反する場合エラーをthrowする", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ simplified: 123, terms: [] }) }],
    });

    await expect(simplify("テスト")).rejects.toThrow();
  });
});
