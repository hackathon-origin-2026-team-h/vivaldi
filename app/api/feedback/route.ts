import { NextResponse } from "next/server";
import { handleApiError, parseBody, TextWithPersonaBodySchema } from "@/lib/api";
import { BASE_SYSTEM_PROMPT, extractText, getClient } from "@/lib/claude";
import { parsePersona } from "@/lib/persona";

const MAX_FEEDBACK_HISTORY = 10;

const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

## タスク
テキストを読んだ聴講者が「わかりにくい」と感じた理由を推測してください。
1〜2文で推測のみ返してください（前置き・説明不要）。
例: "量子もつれなど量子力学固有の概念への不慣れが原因と考えられる"`;

export async function POST(request: Request) {
  const result = await parseBody(request, TextWithPersonaBodySchema);
  if (!result.ok) return result.response;

  const { text, userPersona } = result.data;
  const persona = parsePersona(userPersona);

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `【テキスト】
${text}

【現在の聴講者ペルソナ】
${JSON.stringify(persona)}`,
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
    return handleApiError("process feedback", err);
  }
}
