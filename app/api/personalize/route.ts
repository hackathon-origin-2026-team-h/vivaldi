import { NextResponse } from "next/server";
import { handleApiError, parseBody, TextWithPersonaBodySchema } from "@/lib/api";
import { extractText, getClient } from "@/lib/claude";
import { parsePersona, type UserPersona } from "@/lib/persona";

function summarizePersona(persona: UserPersona): string {
  const parts: string[] = [];
  if (persona.knownDomains.length > 0) {
    parts.push(`詳しい分野: ${persona.knownDomains.join("、")}`);
  }
  if (persona.unknownDomains.length > 0) {
    parts.push(`不慣れな分野: ${persona.unknownDomains.join("、")}`);
  }
  if (persona.feedbackHistory.length > 0) {
    const recent = persona.feedbackHistory.slice(-3).map((f) => f.inference);
    parts.push(`過去のフィードバック: ${recent.join("／")}`);
  }
  return parts.length > 0 ? parts.join("。") : "特になし";
}

export async function POST(request: Request) {
  const result = await parseBody(request, TextWithPersonaBodySchema);
  if (!result.ok) return result.response;

  const { text, userPersona } = result.data;
  const persona = parsePersona(userPersona);

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `以下の発表テキストを、聴講者が理解しやすい表現に意訳してください。

【聴講者の特性】
${summarizePersona(persona)}

【元のテキスト】
${text}

ルール:
- 内容を変えず、表現だけを平易にする
- 専門用語は聴講者が知らない可能性がある場合、括弧で簡潔な説明を補足する
- 意訳後のテキストのみ返す`,
        },
      ],
    });

    const personalized = extractText(response) || text;
    return NextResponse.json({ personalized });
  } catch (err) {
    return handleApiError("personalize text", err);
  }
}
