import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const BodySchema = v.object({
  rawText: v.pipe(v.string(), v.nonEmpty("rawText is required")),
  polishedText: v.pipe(v.string(), v.nonEmpty("polishedText is required")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  const { rawText, polishedText } = result.data;

  const session = await prisma.talkSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const segment = await prisma.transcriptSegment.create({
    data: { sessionId: id, rawText, polishedText },
  });

  return NextResponse.json(segment, { status: 201 });
}
