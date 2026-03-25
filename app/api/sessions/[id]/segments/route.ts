import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { getSessionStub, type Segment } from "@/lib/session";

const BodySchema = v.object({
  rawText: v.pipe(v.string(), v.nonEmpty("rawText is required")),
  polishedText: v.pipe(v.string(), v.nonEmpty("polishedText is required")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await parseBody(request, BodySchema);
  if (!result.ok) return result.response;

  const { env } = await getCloudflareContext({ async: true });
  const stub = getSessionStub(env, id);

  const res = await stub.fetch("https://do/segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.data),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const segment = (await res.json()) as Segment;
  return NextResponse.json(segment, { status: 201 });
}
