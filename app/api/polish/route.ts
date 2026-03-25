import { NextResponse } from "next/server";
import { polishTranscript } from "@/lib/simplify";

const MAX_TEXT_LENGTH = 5000;

export async function POST(request: Request) {
  let body: { text?: string };

  try {
    body = (await request.json()) as { text?: string };
  } catch (err) {
    console.error("Invalid JSON body:", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text is too long" }, { status: 400 });
  }
  try {
    const polished = await polishTranscript(text);
    return NextResponse.json({ polished });
  } catch (err) {
    console.error("polish error:", err);
    return NextResponse.json({ error: "Failed to polish transcript" }, { status: 500 });
  }
}
