import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { rawText?: string; polishedText?: string };
  try {
    body = (await request.json()) as { rawText?: string; polishedText?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rawText, polishedText } = body;
  if (!rawText || !polishedText) {
    return NextResponse.json({ error: "rawText and polishedText are required" }, { status: 400 });
  }

  const session = await prisma.talkSession.findUnique({
    where: { id: params.id },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const segment = await prisma.transcriptSegment.create({
    data: { sessionId: params.id, rawText, polishedText },
  });

  return NextResponse.json(segment, { status: 201 });
}
