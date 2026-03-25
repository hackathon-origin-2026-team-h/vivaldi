import { NextResponse } from "next/server";
import { simplify } from "@/lib/simplify";

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

  try {
    const result = await simplify(text);
    return NextResponse.json(result);
  } catch (err) {
    console.error("simplify error:", err);
    return NextResponse.json({ error: "Failed to simplify text" }, { status: 500 });
  }
}
