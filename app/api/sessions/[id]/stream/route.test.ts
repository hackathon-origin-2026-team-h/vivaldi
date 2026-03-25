// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/pubsub", () => ({
  getSession: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}));

import { getSession, subscribe } from "@/lib/pubsub";

const params = { params: Promise.resolve({ id: "abc" }) };

describe("GET /api/sessions/[id]/stream", () => {
  it("存在しないセッションは 404 を返す", async () => {
    vi.mocked(getSession).mockReturnValueOnce(undefined);

    const req = new Request("http://localhost/api/sessions/abc/stream");
    const res = await GET(req, params);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("セッションが存在すれば SSE レスポンスを返す", async () => {
    vi.mocked(getSession).mockReturnValue({
      id: "abc",
      status: "BEFORE",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });
    vi.mocked(subscribe).mockReturnValue(vi.fn());

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
    vi.mocked(getSession).mockReturnValue({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });
    vi.mocked(subscribe).mockReturnValue(vi.fn());

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
