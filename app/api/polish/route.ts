import { polishTranscript } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const polished = await polishTranscript(text);
    return NextResponse.json({ polished });
  } catch (err) {
    console.error("polish error:", err);
    return NextResponse.json({ error: "Failed to polish transcript" }, { status: 500 });
  }
}
