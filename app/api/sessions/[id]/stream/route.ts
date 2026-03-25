import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.talkSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSegmentId = 0;
  let lastStatus = session.status;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session", status: session.status })}\n\n`));

      let aborted = false;

      const poll = async () => {
        if (aborted) return;
        try {
          const [segments, current] = await Promise.all([
            prisma.transcriptSegment.findMany({
              where: { sessionId: id, id: { gt: lastSegmentId } },
              orderBy: { id: "asc" },
            }),
            prisma.talkSession.findUnique({ where: { id }, select: { status: true } }),
          ]);

          for (const seg of segments) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "segment", ...seg })}\n\n`));
            lastSegmentId = seg.id;
          }

          if (current && current.status !== lastStatus) {
            lastStatus = current.status;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "session", status: current.status })}\n\n`),
            );
          }
        } catch (err) {
          console.error("SSE polling error:", err);
        }
        if (!aborted) setTimeout(poll, 500);
      };

      setTimeout(poll, 500);

      req.signal.addEventListener("abort", () => {
        aborted = true;
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
