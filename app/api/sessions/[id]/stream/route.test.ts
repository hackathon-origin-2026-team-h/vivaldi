// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockWs = {
  accept: vi.fn(),
  addEventListener: vi.fn(),
  close: vi.fn(),
};

const mockStub = { fetch: vi.fn() };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => Promise.resolve({ env: {} })),
}));

vi.mock("@/lib/session", () => ({
  getSessionStub: vi.fn(() => mockStub),
}));

const params = { params: Promise.resolve({ id: "abc" }) };

const makeWsResponse = () =>
  Object.assign(new Response(null, { status: 200 }), { webSocket: mockWs });

describe("GET /api/sessions/[id]/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在しないセッションは 404 を返す", async () => {
    mockStub.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

    const req = new Request("http://localhost/api/sessions/abc/stream");
    const res = await GET(req, params);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("セッションが存在すれば SSE レスポンスを返す", async () => {
    const sessionState = { id: "abc", status: "BEFORE", segments: [], createdAt: new Date().toISOString() };
    mockStub.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionState), { status: 200 }))
      .mockResolvedValueOnce(makeWsResponse());

    const controller = new AbortController();
    const req = new Request("http://localhost/api/sessions/abc/stream", {
      signal: controller.signal,
    });
    const res = await GET(req, params);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    controller.abort();
  });

  it("初回メッセージにセッションステータスが含まれる", async () => {
    const sessionState = { id: "abc", status: "DURING", segments: [], createdAt: new Date().toISOString() };
    mockStub.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionState), { status: 200 }))
      .mockResolvedValueOnce(makeWsResponse());

    const controller = new AbortController();
    const req = new Request("http://localhost/api/sessions/abc/stream", {
      signal: controller.signal,
    });
    const res = await GET(req, params);
    controller.abort();

    expect(res.body).not.toBeNull();
    if (!res.body) {
      throw new Error("Expected response body for SSE stream");
    }

    const reader = res.body.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('"type":"session"');
    expect(text).toContain('"status":"DURING"');
  });
});
