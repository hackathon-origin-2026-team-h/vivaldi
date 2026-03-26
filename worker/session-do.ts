/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";

export type SessionStatus = "BEFORE" | "DURING" | "AFTER";

export type Segment = {
  id: number;
  sessionId: string;
  rawText: string;
  polishedText: string;
  createdAt: string;
};

export type SessionState = {
  id: string;
  status: SessionStatus;
  createdAt: string;
  segments: Segment[];
  nextSegmentId: number;
};

export class SessionDO extends DurableObject {
  private cached: SessionState | null = null;

  private async loadState(): Promise<SessionState | null> {
    if (!this.cached) {
      this.cached = (await this.ctx.storage.get<SessionState>("state")) ?? null;
    }
    return this.cached;
  }

  private broadcast(event: unknown): void {
    const message = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // already closed
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // PUT / — create session
    if (request.method === "PUT" && url.pathname === "/") {
      const { id } = (await request.json()) as { id: string };
      const state: SessionState = {
        id,
        status: "BEFORE",
        createdAt: new Date().toISOString(),
        segments: [],
        nextSegmentId: 1,
      };
      this.cached = state;
      await this.ctx.storage.put("state", state);
      return Response.json(state, { status: 201 });
    }

    // GET /state — return session state
    if (request.method === "GET" && url.pathname === "/state") {
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      return Response.json(state);
    }

    // PATCH /status — update status and broadcast
    if (request.method === "PATCH" && url.pathname === "/status") {
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      const { status } = (await request.json()) as { status: SessionStatus };
      state.status = status;
      await this.ctx.storage.put("state", state);
      this.broadcast({ type: "session", status });
      return Response.json({ id: state.id, status: state.status });
    }

    // POST /segments — add segment and broadcast
    if (request.method === "POST" && url.pathname === "/segments") {
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      const { rawText, polishedText } = (await request.json()) as {
        rawText: string;
        polishedText: string;
      };
      const segment: Segment = {
        id: state.nextSegmentId++,
        sessionId: state.id,
        rawText,
        polishedText,
        createdAt: new Date().toISOString(),
      };
      state.segments.push(segment);
      await this.ctx.storage.put("state", state);
      this.broadcast({ type: "segment", ...segment });
      return Response.json(segment, { status: 201 });
    }

    // GET /subscribe — WebSocket upgrade for SSE relay
    if (request.method === "GET" && url.pathname === "/subscribe") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  // Required by WebSocket Hibernation API
  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // Clients are receive-only
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    ws.close(code, reason);
  }

  webSocketError(_ws: WebSocket, _error: unknown): void {
    // no-op
  }
}
