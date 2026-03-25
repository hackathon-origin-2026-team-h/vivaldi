// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    talkSession: {
      findUnique: vi.fn(),
    },
    transcriptSegment: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const params = { params: { id: "abc" } };

describe("GET /api/sessions/[id]/stream", () => {
  it("存在しないセッションは 404 を返す", async () => {
    vi.mocked(prisma.talkSession.findUnique).mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/sessions/abc/stream");
    const res = await GET(req, params);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("セッションが存在すれば SSE レスポンスを返す", async () => {
    vi.mocked(prisma.talkSession.findUnique).mockResolvedValue({
      id: "abc",
      status: "BEFORE",
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.transcriptSegment.findMany).mockResolvedValue([]);

    const controller = new AbortController();
    const req = new Request("http://localhost/api/sessions/abc/stream", {
      signal: controller.signal,
    });
    const res = await GET(req, params);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    // 接続を閉じてポーリングを停止
    controller.abort();
  });

  it("初回メッセージにセッションステータスが含まれる", async () => {
    vi.mocked(prisma.talkSession.findUnique).mockResolvedValue({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
    } as never);
    vi.mocked(prisma.transcriptSegment.findMany).mockResolvedValue([]);

    const controller = new AbortController();
    const req = new Request("http://localhost/api/sessions/abc/stream", {
      signal: controller.signal,
    });
    const res = await GET(req, params);
    controller.abort();

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('"type":"session"');
    expect(text).toContain('"status":"DURING"');
  });
});
