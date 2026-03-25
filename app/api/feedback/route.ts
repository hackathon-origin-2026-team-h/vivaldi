import { NextResponse } from "next/server";
import { getClient } from "@/lib/claude";
import { parsePersona } from "@/lib/persona";

const MAX_FEEDBACK_HISTORY = 10;

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

    const block = response.content.find((b) => b.type === "text");
    const inference = block?.type === "text" ? block.text.trim() : "";
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
