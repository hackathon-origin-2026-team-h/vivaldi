import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: streamMock };
  },
}));

import { defaultPipeline, runPipeline } from "./llm";

function makeStream(text: string) {
  const message = { content: [{ type: "text", text }] };
  return { finalMessage: () => Promise.resolve(message) };
}

beforeEach(() => {
  streamMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  (globalThis as Record<string, unknown>)._claude = undefined;
});

describe("runPipeline", () => {
  it("enabled なステップを順番に実行し、各 input/output を記録する", async () => {
    const steps = [
      { name: "step1", enabled: true, run: async (t: string) => `${t}+1` },
      { name: "step2", enabled: true, run: async (t: string) => `${t}+2` },
    ];

    const result = await runPipeline("hello", steps);

    expect(result.original).toBe("hello");
    expect(result.output).toBe("hello+1+2");
    expect(result.steps[0]).toMatchObject({ name: "step1", input: "hello", output: "hello+1", enabled: true });
    expect(result.steps[1]).toMatchObject({ name: "step2", input: "hello+1", output: "hello+1+2", enabled: true });
  });

  it("disabled なステップはスキップして input をそのまま output に渡す", async () => {
    const run = vi.fn(async (t: string) => `${t}+skipped`);
    const steps = [
      { name: "skip", enabled: false, run },
      { name: "active", enabled: true, run: async (t: string) => `${t}+active` },
    ];

    const result = await runPipeline("hello", steps);

    expect(run).not.toHaveBeenCalled();
    expect(result.steps[0]).toMatchObject({ name: "skip", input: "hello", output: "hello", enabled: false });
    expect(result.output).toBe("hello+active");
  });

  it("simplify ステップが実行された場合 terms を抽出する", async () => {
    const simplifyJson = JSON.stringify({
      text: "やさしい文章",
      terms: [{ word: "専門用語", explanation: "わかりやすい説明" }],
    });
    streamMock.mockReturnValue(makeStream(simplifyJson));

    const steps = [defaultPipeline.find((s) => s.name === "simplify")!];
    const result = await runPipeline("難しいテキスト", steps);

    expect(result.output).toBe("やさしい文章");
    expect(result.terms).toEqual([{ word: "専門用語", explanation: "わかりやすい説明" }]);
  });

  it("simplify ステップが disabled の場合 terms は空配列", async () => {
    const steps = [{ ...defaultPipeline.find((s) => s.name === "simplify")!, enabled: false }];
    const result = await runPipeline("テスト", steps);

    expect(result.terms).toEqual([]);
    expect(result.output).toBe("テスト");
  });

  it("ステップが空の場合は original をそのまま返す", async () => {
    const result = await runPipeline("そのまま", []);
    expect(result.output).toBe("そのまま");
    expect(result.steps).toHaveLength(0);
    expect(result.terms).toEqual([]);
  });
});

describe("removeFillers ステップ", () => {
  it("Claude のレスポンスをそのまま output にする", async () => {
    streamMock.mockReturnValue(makeStream("言い淀みを除去した文章"));

    const step = defaultPipeline.find((s) => s.name === "removeFillers")!;
    const result = await runPipeline("えーと、難しいテキスト", [step]);

    expect(result.output).toBe("言い淀みを除去した文章");
  });

  it("Claude が空文字を返した場合は入力をフォールバックとして返す", async () => {
    streamMock.mockReturnValue(makeStream(""));

    const step = defaultPipeline.find((s) => s.name === "removeFillers")!;
    const result = await runPipeline("入力テキスト", [step]);

    expect(result.output).toBe("入力テキスト");
  });
});

describe("translate ステップ", () => {
  it("defaultPipeline では disabled になっている", () => {
    const step = defaultPipeline.find((s) => s.name === "translate");
    expect(step?.enabled).toBe(false);
  });

  it("enabled にすると Claude のレスポンスを返す", async () => {
    streamMock.mockReturnValue(makeStream("Translated text"));

    const step = { ...defaultPipeline.find((s) => s.name === "translate")!, enabled: true };
    const result = await runPipeline("日本語テキスト", [step]);

    expect(result.output).toBe("Translated text");
  });
});

describe("simplify ステップ — JSON パース", () => {
  it("マークダウンコードブロックで囲まれた JSON も正しくパースする", async () => {
    const json = JSON.stringify({ text: "平易な文", terms: [] });
    streamMock.mockReturnValue(makeStream(`\`\`\`json\n${json}\n\`\`\``));

    const step = defaultPipeline.find((s) => s.name === "simplify")!;
    const result = await runPipeline("テスト", [step]);

    expect(result.output).toBe("平易な文");
    expect(result.terms).toEqual([]);
  });

  it("不正な JSON の場合エラーをthrowする", async () => {
    streamMock.mockReturnValue(makeStream("not json"));

    const step = defaultPipeline.find((s) => s.name === "simplify")!;
    await expect(runPipeline("テスト", [step])).rejects.toThrow(SyntaxError);
  });
});
