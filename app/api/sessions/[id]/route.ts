import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { getSessionStub, type SessionState } from "@/lib/session";

const PatchBodySchema = v.object({
  status: v.picklist(["DURING", "AFTER"], "status must be one of: DURING, AFTER"),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const stub = getSessionStub(env, id);

  const res = await stub.fetch("https://do/state");
  if (!res.ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const session = (await res.json()) as SessionState;
  return NextResponse.json({ id: session.id, status: session.status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await parseBody(request, PatchBodySchema);
  if (!result.ok) return result.response;

  const { env } = await getCloudflareContext({ async: true });
  const stub = getSessionStub(env, id);

  const res = await stub.fetch("https://do/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: result.data.status }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const updated = (await res.json()) as { id: string; status: string };
  return NextResponse.json(updated);
}
