import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getSessionStub } from "@/lib/session";

function makeSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function POST() {
  const { env } = await getCloudflareContext({ async: true });
  const id = makeSessionId();
  const stub = getSessionStub(env, id);
  await stub.fetch("https://do/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return NextResponse.json({ id }, { status: 201 });
}
