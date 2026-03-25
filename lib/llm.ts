import { getClient } from "@/lib/claude";

const MODEL = "claude-sonnet-4-20250514";

export type PipelineStep = {
  name: string;
  enabled: boolean;
  run: (text: string) => Promise<string>;
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

async function removeFillersStep(text: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "「えー」「あの」「まあ」「えっと」などの言い淀みを除去してください。意味のある言葉は一切変えないこと。テキストのみ返してください（JSON不要）。",
    messages: [{ role: "user", content: text }],
  });
  const block = response.content.find((b) => b.type === "text");
  const result = block?.type === "text" ? block.text.trim() : "";
  return result !== "" ? result : text;
}

type SimplifyResponse = {
  text: string;
  terms: Term[];
};

// Parses the simplify JSON response and returns both text and terms
function parseSimplifyResponse(raw: string): SimplifyResponse {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { text: string; terms: { word: string; explanation: string }[] };
  return {
    text: parsed.text,
    terms: parsed.terms ?? [],
  };
}

// Holds terms extracted during the simplify step so runPipeline can access them
let _lastSimplifyTerms: Term[] = [];

async function simplifyStep(text: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      '専門用語・難しい言葉を小学生でもわかる言葉に言い換えてください。元の文章の意味・ニュアンスを変えないこと。以下のJSON形式のみで返してください（マークダウン・前置きテキスト不要）:\n{"text": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "平易化された説明"}]}',
    messages: [{ role: "user", content: text }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return text;

  const parsed = parseSimplifyResponse(block.text);
  _lastSimplifyTerms = parsed.terms;
  return parsed.text;
}

async function translateStep(text: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "日本語を自然な英語に翻訳してください。テキストのみ返してください（JSON不要）。",
    messages: [{ role: "user", content: text }],
  });
  const block = response.content.find((b) => b.type === "text");
  const result = block?.type === "text" ? block.text.trim() : "";
  return result !== "" ? result : text;
}

export async function runPipeline(
  text: string,
  steps: PipelineStep[],
): Promise<PipelineResult> {
  _lastSimplifyTerms = [];

  const stepResults: PipelineResult["steps"] = [];
  let current = text;

  for (const step of steps) {
    const input = current;
    let output: string;

    if (step.enabled) {
      output = await step.run(input);
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
    terms: _lastSimplifyTerms,
  };
}

export const defaultPipeline: PipelineStep[] = [
  { name: "removeFillers", enabled: true, run: removeFillersStep },
  { name: "simplify", enabled: true, run: simplifyStep },
  { name: "translate", enabled: false, run: translateStep },
];
