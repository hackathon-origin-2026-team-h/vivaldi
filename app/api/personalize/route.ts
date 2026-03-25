import { NextResponse } from "next/server";
import { gemini } from "@/lib/gemini";
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
  let body: { text?: string; userPersona?: unknown };
  try {
    body = (await request.json()) as { text?: string; userPersona?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body;
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const persona = parsePersona(body.userPersona);

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `以下の発表テキストを、聴講者が理解しやすい表現に意訳してください。

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
        },
      ],
    });

    const personalized = response.text?.trim() ?? text;
    return NextResponse.json({ personalized });
  } catch (err) {
    console.error("personalize error:", err);
    return NextResponse.json({ error: "Failed to personalize text" }, { status: 500 });
  }
}
