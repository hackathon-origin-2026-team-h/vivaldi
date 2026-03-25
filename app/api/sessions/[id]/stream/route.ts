import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionStub, type SessionState } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const stub = getSessionStub(env, id);

  // Fetch current session state
  const stateRes = await stub.fetch("https://do/state");
  if (!stateRes.ok) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const session = (await stateRes.json()) as SessionState;

  // Open a WebSocket connection to the DO for live events
  const wsRes = await stub.fetch("https://do/subscribe", {
    headers: { Upgrade: "websocket" },
  });
  const ws = (wsRes as Response & { webSocket: WebSocket | null }).webSocket;
  if (!ws) {
    return new Response("Failed to connect to session", { status: 500 });
  }
  ws.accept();

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Flush initial state synchronously before returning the response
  const flush = async () => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "session", status: session.status })}\n\n`));
    for (const seg of session.segments) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "segment", ...seg })}\n\n`));
    }
  };
  void flush();

  // Forward DO broadcast events to the SSE stream
  ws.addEventListener("message", (event) => {
    const data = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
    writer.write(encoder.encode(`data: ${data}\n\n`)).catch(() => {});
  });
  ws.addEventListener("close", () => {
    writer.close().catch(() => {});
  });
  ws.addEventListener("error", () => {
    writer.close().catch(() => {});
  });

  // Clean up when the client disconnects
  req.signal.addEventListener("abort", () => {
    try {
      ws.close();
    } catch {
      // already closed
    }
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
