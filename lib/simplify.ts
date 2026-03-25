import Anthropic from "@anthropic-ai/sdk";

export type Term = {
  word: string;
  explanation: string;
};

export type SimplifiedResult = {
  original: string;
  simplified: string;
  terms: Term[];
};

const SYSTEM_PROMPT = `専門用語・難しい言葉を小学生でもわかる言葉に言い換えてください。元の文章の意味・ニュアンスを変えないこと。専門用語と平易化した説明のペアも抽出してください。以下のJSON形式のみで返してください（マークダウン・前置きテキスト不要）:
{"simplified": "平易化された文章", "terms": [{"word": "専門用語", "explanation": "平易化された説明"}]}`;

const POLISH_SYSTEM_PROMPT = `あなたは音声認識テキストの校正アシスタントです。誤認識や言い淀み、繰り返しを修正し、自然で読みやすい文章に整えてください。内容は変えずに表現だけ改善し、修正後のテキストのみを返してください。`;

export async function polishTranscript(rawText: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: POLISH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const result = content.text.trim();
  return result !== "" ? result : rawText;
}

export async function simplify(text: string): Promise<SimplifiedResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const jsonText = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = JSON.parse(jsonText) as { simplified: string; terms: Term[] };

  return {
    original: text,
    simplified: parsed.simplified,
    terms: parsed.terms,
  };
}
