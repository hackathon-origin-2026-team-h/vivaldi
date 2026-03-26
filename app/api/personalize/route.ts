import { NextResponse } from "next/server";
import * as v from "valibot";
import {
  handleApiError,
  parseBody,
  TextWithPersonaBodySchema,
} from "@/lib/api";
import {
  BASE_SYSTEM_PROMPT,
  extractText,
  getClient,
  parseJsonResponse,
} from "@/lib/claude";
import { parsePersona, type UserPersona } from "@/lib/persona";

const PersonalizeResponseSchema = v.object({ result: v.string() });

const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

## タスク
発表テキストを聴講者の特性に合わせて意訳してください。
- 専門用語は聴講者が知らない可能性がある場合、括弧で簡潔な説明を補足する
- 意訳できない場合は元々のテキストをそのまま返す
- 意訳に成功した場合、以下のJSON形式のみで返す（前置きテキスト不要）: {"result": "意訳後のテキスト"}`;

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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `【聴講者の特性】
${summarizePersona(persona)}

【元のテキスト】
${text}`,
        },
      ],
    });

    let personalized: string;
    try {
      const raw = extractText(response);
      const parsed = parseJsonResponse(PersonalizeResponseSchema, raw);
      personalized = parsed.result;
    } catch {
      personalized = text;
    }
    return NextResponse.json({ personalized });
  } catch (err) {
    return handleApiError("personalize text", err);
  }
}
