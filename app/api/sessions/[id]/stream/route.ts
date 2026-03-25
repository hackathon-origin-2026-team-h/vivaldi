import { NextResponse } from "next/server";
import { getSession, subscribe } from "@/lib/pubsub";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current session status
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session", status: session.status })}\n\n`));

      // Send all existing segments
      for (const seg of session.segments) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "segment", ...seg })}\n\n`));
      }

      // Push new events as they arrive
      const unsubscribe = subscribe(id, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
