import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.talkSession.findUnique({
    where: { id: params.id },
  });
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let lastSegmentId = 0;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial session status
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session", status: session.status })}\n\n`));

      const interval = setInterval(async () => {
        try {
          const segments = await prisma.transcriptSegment.findMany({
            where: { sessionId: params.id, id: { gt: lastSegmentId } },
            orderBy: { id: "asc" },
          });

          for (const seg of segments) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "segment", ...seg })}\n\n`));
            lastSegmentId = seg.id;
          }

          // Also check for status changes
          const current = await prisma.talkSession.findUnique({
            where: { id: params.id },
            select: { status: true },
          });
          if (current && current.status !== session.status) {
            session.status = current.status;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "session", status: current.status })}\n\n`),
            );
          }
        } catch (err) {
          console.error("SSE polling error:", err);
        }
      }, 500);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
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
