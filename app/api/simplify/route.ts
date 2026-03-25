import * as v from "valibot";
import { handleApiError } from "@/lib/api";
import { defaultPipeline, runPipeline } from "@/lib/llm";

const RequestSchema = v.object({
  text: v.pipe(v.string(), v.nonEmpty("text is required")),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = v.safeParse(RequestSchema, body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.issues[0]?.message ?? "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await runPipeline(parsed.output.text, defaultPipeline);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return handleApiError("process text", err);
  }
}
