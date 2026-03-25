import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { addSegment, getSession } from "@/lib/pubsub";

const BodySchema = v.object({
  rawText: v.pipe(v.string(), v.nonEmpty("rawText is required")),
  polishedText: v.pipe(v.string(), v.nonEmpty("polishedText is required")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  if (!getSession(id)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { rawText, polishedText } = result.data;
  const segment = addSegment(id, rawText, polishedText);
  return NextResponse.json(segment, { status: 201 });
}
