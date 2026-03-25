import { NextResponse } from "next/server";
import { gemini } from "@/lib/gemini";

type UserPersona = {
  knownDomains: string[];
  unknownDomains: string[];
  feedbackHistory: Array<{ inference: string; timestamp: number }>;
};

export async function POST(request: Request) {
  let body: { text?: string; userPersona?: UserPersona };
  try {
    body = (await request.json()) as { text?: string; userPersona?: UserPersona };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, userPersona } = body;
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const persona: UserPersona = userPersona ?? {
    knownDomains: [],
    unknownDomains: [],
    feedbackHistory: [],
  };

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `以下のテキストを読んだ聴講者が「わかりにくい」と感じました。

【テキスト】
${text}

【現在の聴講者ペルソナ】
${JSON.stringify(persona)}

このテキストの何がわかりにくかったか、1〜2文で推測してください。
例: "量子もつれなど量子力学固有の概念への不慣れが原因と考えられる"
推測のみ返してください。`,
            },
          ],
        },
      ],
    });

    const inference = response.text?.trim() ?? "";
    const updatedPersona: UserPersona = {
      ...persona,
      feedbackHistory: [...persona.feedbackHistory, { inference, timestamp: Date.now() }],
    };

    return NextResponse.json({ updatedPersona, inference });
  } catch (err) {
    console.error("feedback error:", err);
    return NextResponse.json({ error: "Failed to process feedback" }, { status: 500 });
  }
}
