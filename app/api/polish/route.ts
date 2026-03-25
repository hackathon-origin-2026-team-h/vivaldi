import { NextResponse } from "next/server";
import * as v from "valibot";
import { handleApiError, parseBody, textField } from "@/lib/api";
import { polishTranscript } from "@/lib/polish";

const BodySchema = v.object({
  text: v.pipe(textField, v.trim(), v.maxLength(5000, "text is too long")),
});

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  try {
    const polished = await polishTranscript(result.data.text);
    return NextResponse.json({ polished });
  } catch (err) {
    return handleApiError("polish transcript", err);
  }
}
