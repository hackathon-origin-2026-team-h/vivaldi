import { NextResponse } from "next/server";
import { defaultPipeline, runPipeline } from "@/lib/llm";

export async function POST(request: Request) {
  let body: { text?: string; steps?: string[] };

  try {
    body = (await request.json()) as { text?: string; steps?: string[] };
  } catch (err) {
    console.error("Invalid JSON body:", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Build pipeline: filter defaultPipeline by requested step names (if provided),
  // and override enabled flag accordingly.
  const pipeline =
    body.steps && body.steps.length > 0
      ? defaultPipeline.map((step) => ({
          ...step,
          enabled: (body.steps as string[]).includes(step.name),
        }))
      : defaultPipeline;

  try {
    const result = await runPipeline(text, pipeline);
    return NextResponse.json(result);
  } catch (err) {
    console.error("pipeline error:", err);
    return NextResponse.json({ error: "Failed to process text" }, { status: 500 });
  }
}
