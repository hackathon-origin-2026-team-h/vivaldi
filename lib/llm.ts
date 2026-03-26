import * as v from "valibot";
import {
  BASE_SYSTEM_PROMPT,
  extractText,
  getClient,
  parseJsonResponse,
} from "@/lib/claude";

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

const TextResultSchema = v.object({ result: v.string() });

async function callLLMJson(system: string, text: string): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: text }],
  });
  try {
    const raw = extractText(response);
    const parsed = parseJsonResponse(TextResultSchema, raw);
    return parsed.result;
  } catch {
    return text;
  }
}

const REMOVE_FILLERS_SYSTEM = `${BASE_SYSTEM_PROMPT}

## タスク
「えー」「あの」「まあ」「えっと」などの言い淀みを除去してください。
以下のJSON形式のみで返してください（前置きテキスト不要）:
{"result": "修正後のテキスト"}`;

async function removeFillersStep(text: string): Promise<string> {
  return callLLMJson(REMOVE_FILLERS_SYSTEM, text);
}

const SimplifyResponseSchema = v.object({
  text: v.string(),
  terms: v.array(v.object({ word: v.string(), explanation: v.string() })),
});

const SIMPLIFY_SYSTEM = `${BASE_SYSTEM_PROMPT}

## タスク
専門用語・難しい言葉を小学生でもわかる言葉に言い換えてください。専門用語と平易化した説明のペアも抽出してください。
以下のJSON形式のみで返してください（マークダウン・前置きテキスト不要）:
{"text": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "平易化された説明"}]}`;

async function simplifyStep(
  text: string,
): Promise<{ output: string; terms: Term[] }> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SIMPLIFY_SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  const raw = extractText(response);
  if (!raw) return { output: text, terms: [] };
  try {
    const parsed = parseJsonResponse(SimplifyResponseSchema, raw);
    return { output: parsed.text, terms: parsed.terms };
  } catch {
    return { output: text, terms: [] };
  }
}

const TRANSLATE_SYSTEM = `${BASE_SYSTEM_PROMPT}

## タスク
日本語を自然な英語に翻訳してください。
以下のJSON形式のみで返してください（前置きテキスト不要）:
{"result": "翻訳後のテキスト"}`;

async function translateStep(text: string): Promise<string> {
  return callLLMJson(TRANSLATE_SYSTEM, text);
}

export async function runPipeline(
  text: string,
  steps: PipelineStep[],
): Promise<PipelineResult> {
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
