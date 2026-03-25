import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { extractText, getClient } from "@/lib/claude";
import { parsePersona } from "@/lib/persona";

const BodySchema = v.object({
  text: v.pipe(v.string(), v.nonEmpty("text is required")),
  userPersona: v.optional(v.unknown()),
});

const MAX_FEEDBACK_HISTORY = 10;

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  const { text, userPersona } = result.data;
  const persona = parsePersona(userPersona);

  try {
    const response = await getClient().messages.create({
      model: "claude-opus-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `以下のテキストを読んだ聴講者が「わかりにくい」と感じました。

【テキスト】
${text}

【現在の聴講者ペルソナ】
${JSON.stringify(persona)}

このテキストの何がわかりにくかったか、1〜2文で推測してください。
例: "量子もつれなど量子力学固有の概念への不慣れが原因と考えられる"
推測のみ返してください。`,
        },
      ],
    });

    const inference = extractText(response);
    const updatedPersona = {
      ...persona,
      feedbackHistory: [...persona.feedbackHistory, { inference, timestamp: Date.now() }].slice(-MAX_FEEDBACK_HISTORY),
    };

    return NextResponse.json({ updatedPersona, inference });
  } catch (err) {
    console.error("feedback error:", err);
    return NextResponse.json({ error: "Failed to process feedback" }, { status: 500 });
  }
}
