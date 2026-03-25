import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { defaultPipeline, runPipeline } from "./llm";

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function getPipelineStep(name: (typeof defaultPipeline)[number]["name"]) {
  const step = defaultPipeline.find((candidate) => candidate.name === name);
  if (!step) {
    throw new Error(`Missing pipeline step: ${name}`);
  }
  return step;
}

beforeEach(() => {
  createMock.mockReset();
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
    createMock.mockResolvedValue(textResponse(simplifyJson));

    const steps = [getPipelineStep("simplify")];
    const result = await runPipeline("難しいテキスト", steps);

    expect(result.output).toBe("やさしい文章");
    expect(result.terms).toEqual([{ word: "専門用語", explanation: "わかりやすい説明" }]);
  });

  it("simplify ステップが disabled の場合 terms は空配列", async () => {
    const steps = [{ ...getPipelineStep("simplify"), enabled: false }];
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
    createMock.mockResolvedValue(textResponse("言い淀みを除去した文章"));

    const step = getPipelineStep("removeFillers");
    const result = await runPipeline("えーと、難しいテキスト", [step]);

    expect(result.output).toBe("言い淀みを除去した文章");
  });

  it("Claude が空文字を返した場合は入力をフォールバックとして返す", async () => {
    createMock.mockResolvedValue(textResponse(""));

    const step = getPipelineStep("removeFillers");
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
    createMock.mockResolvedValue(textResponse("Translated text"));

    const step = { ...getPipelineStep("translate"), enabled: true };
    const result = await runPipeline("日本語テキスト", [step]);

    expect(result.output).toBe("Translated text");
  });
});

describe("simplify ステップ — JSON パース", () => {
  it("マークダウンコードブロックで囲まれた JSON も正しくパースする", async () => {
    const json = JSON.stringify({ text: "平易な文", terms: [] });
    createMock.mockResolvedValue(textResponse(`\`\`\`json\n${json}\n\`\`\``));

    const step = getPipelineStep("simplify");
    const result = await runPipeline("テスト", [step]);

    expect(result.output).toBe("平易な文");
    expect(result.terms).toEqual([]);
  });

  it("不正な JSON の場合エラーをthrowする", async () => {
    createMock.mockResolvedValue(textResponse("not json"));

    const step = getPipelineStep("simplify");
    await expect(runPipeline("テスト", [step])).rejects.toThrow(SyntaxError);
  });
});
