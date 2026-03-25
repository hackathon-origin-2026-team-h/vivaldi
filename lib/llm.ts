import * as v from "valibot";
import { extractText, getClient, parseJsonResponse } from "@/lib/claude";

const MODEL = "claude-haiku-4-5-20251001";

export type PipelineStep = {
  name: string;
  enabled: boolean;
  run: (text: string) => Promise<string | { output: string; terms?: Term[] }>;
};

export type Term = {
  word: string;
  explanation: string;
};

export type PipelineResult = {
  original: string;
  output: string;
  steps: {
    name: string;
    input: string;
    output: string;
    enabled: boolean;
  }[];
  terms: Term[];
};

async function callLLM(system: string, text: string, maxTokens: number, label?: string): Promise<string> {
  const start = Date.now();
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: text }],
  });
  const message = await stream.finalMessage();
  if (label) console.log(`[llm:${label}] ${Date.now() - start}ms`);
  return extractText(message) || text;
}

async function removeFillersStep(text: string): Promise<string> {
  return callLLM(
    "「えー」「あの」「まあ」「えっと」などの言い淀みを除去してください。意味のある言葉は一切変えないこと。テキストのみ返してください（JSON不要）。",
    text,
    64,
    "removeFillers",
  );
}

const SimplifyResponseSchema = v.object({
  text: v.string(),
  terms: v.array(v.object({ word: v.string(), explanation: v.string() })),
});

async function simplifyStep(text: string): Promise<{ output: string; terms: Term[] }> {
  const start = Date.now();
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 256,
    system:
      '専門用語・難しい言葉を小学生でもわかる言葉に言い換えてください。元の文章の意味・ニュアンスを変えないこと。以下のJSON形式のみで返してください（マークダウン・前置きテキスト不要）:\n{"text": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "平易化された説明"}]}',
    messages: [{ role: "user", content: text }],
  });
  const message = await stream.finalMessage();
  console.log(`[llm:simplify] ${Date.now() - start}ms`);
  const raw = extractText(message);
  if (!raw) return { output: text, terms: [] };
  const parsed = parseJsonResponse(SimplifyResponseSchema, raw);
  return { output: parsed.text, terms: parsed.terms };
}

async function translateStep(text: string): Promise<string> {
  return callLLM(
    "日本語を自然な英語に翻訳してください。テキストのみ返してください（JSON不要）。",
    text,
    512,
    "translate",
  );
}

export async function runPipeline(text: string, steps: PipelineStep[]): Promise<PipelineResult> {
  const stepResults: PipelineResult["steps"] = [];
  let current = text;
  let terms: Term[] = [];

  for (const step of steps) {
    const input = current;
    let output: string;

    if (step.enabled) {
      const raw = await step.run(input);
      if (typeof raw === "string") {
        output = raw;
      } else {
        output = raw.output;
        if (raw.terms) terms = raw.terms;
      }
    } else {
      output = input;
    }

    stepResults.push({ name: step.name, input, output, enabled: step.enabled });
    current = output;
  }

  return {
    original: text,
    output: current,
    steps: stepResults,
    terms,
  };
}

export const defaultPipeline: PipelineStep[] = [
  { name: "removeFillers", enabled: true, run: removeFillersStep },
  { name: "simplify", enabled: true, run: simplifyStep },
  { name: "translate", enabled: false, run: translateStep },
];
