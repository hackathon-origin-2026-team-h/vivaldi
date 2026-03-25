import { handleApiError, parseBody, TextBodySchema } from "@/lib/api";
import { defaultPipeline, runPipeline } from "@/lib/llm";

export async function POST(request: Request) {
  const parsed = await parseBody(request, TextBodySchema);
  if (!parsed.ok) return parsed.response;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runPipeline(parsed.data.text, defaultPipeline);
        controller.enqueue(encoder.encode(JSON.stringify(result)));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    },
  });
}

export function onError(err: unknown) {
  return handleApiError("process text", err);
}
