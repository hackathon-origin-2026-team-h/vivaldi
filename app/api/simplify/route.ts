import { NextResponse } from "next/server";
import { defaultPipeline, runPipeline } from "@/lib/llm";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { simplify } from "@/lib/simplify";

const BodySchema = v.object({ text: v.pipe(v.string(), v.nonEmpty("text is required")) });

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

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
