import { NextResponse } from "next/server";
import { defaultPipeline, runPipeline } from "@/lib/llm";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { simplify } from "@/lib/simplify";

const BodySchema = v.object({ text: v.pipe(v.string(), v.nonEmpty("text is required")) });

export async function POST(request: Request) {
  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  // Validate steps: must be an array of strings if provided.
  if (
    body.steps !== undefined &&
    (!Array.isArray(body.steps) || !body.steps.every((s) => typeof s === "string"))
  ) {
    return NextResponse.json(
      { error: "steps must be an array of strings" },
      { status: 400 },
    );
  }

  const steps = Array.isArray(body.steps) ? body.steps : undefined;

  // Build pipeline: if body.steps is provided, select matching steps from
  // defaultPipeline in the order specified by body.steps. If a requested step
  // name does not exist in defaultPipeline, return 400. If body.steps is not
  // provided or empty, use defaultPipeline as-is.
  let pipeline = defaultPipeline;

  if (body.steps && body.steps.length > 0) {
    const stepMap = new Map(defaultPipeline.map((step) => [step.name, step]));
    const selectedPipeline = [];

    for (const stepName of body.steps) {
      const step = stepMap.get(stepName);
      if (!step) {
        return NextResponse.json(
          { error: `Unknown step: ${stepName}` },
          { status: 400 },
        );
      }
      selectedPipeline.push(step);
    }

    pipeline = selectedPipeline;
  }
  try {
    const result = await runPipeline(text, pipeline);
    return NextResponse.json(result);
  } catch (err) {
    console.error("pipeline error:", err);
    return NextResponse.json({ error: "Failed to process text" }, { status: 500 });
  }
}
