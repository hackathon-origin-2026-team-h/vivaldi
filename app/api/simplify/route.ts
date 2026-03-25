import { NextResponse } from "next/server";
import { handleApiError, parseBody, TextBodySchema } from "@/lib/api";
import { defaultPipeline, runPipeline } from "@/lib/llm";

export async function POST(request: Request) {
  const parsed = await parseBody(request, TextBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await runPipeline(parsed.data.text, defaultPipeline);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError("process text", err);
  }
}
