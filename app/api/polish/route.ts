import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { polishTranscript } from "@/lib/polish";

const BodySchema = v.object({
  text: v.pipe(v.string(), v.trim(), v.nonEmpty("text is required"), v.maxLength(5000, "text is too long")),
});

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  try {
    const polished = await polishTranscript(result.data.text);
    return NextResponse.json({ polished });
  } catch (err) {
    console.error("polish error:", err);
    return NextResponse.json({ error: "Failed to polish transcript" }, { status: 500 });
  }
}
