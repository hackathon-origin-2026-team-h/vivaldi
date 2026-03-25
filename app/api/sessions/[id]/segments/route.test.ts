// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    talkSession: {
      findUnique: vi.fn(),
    },
    transcriptSegment: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = () => vi.mocked(prisma.talkSession.findUnique);
const mockCreate = () => vi.mocked(prisma.transcriptSegment.create);

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/sessions/abc/segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = { params: { id: "abc" } };

describe("POST /api/sessions/[id]/segments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("セグメントを作成して 201 を返す", async () => {
    mockFindUnique().mockResolvedValueOnce({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
    } as never);
    mockCreate().mockResolvedValueOnce({
      id: 1,
      sessionId: "abc",
      rawText: "えっと、今日は",
      polishedText: "今日は",
      createdAt: new Date(),
    } as never);

    const res = await POST(makeRequest({ rawText: "えっと、今日は", polishedText: "今日は" }), params);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ id: 1, sessionId: "abc" });
  });

  it("rawText が空なら 400 を返す", async () => {
    const res = await POST(makeRequest({ polishedText: "今日は" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
    expect(mockCreate()).not.toHaveBeenCalled();
  });

  it("polishedText が空なら 400 を返す", async () => {
    const res = await POST(makeRequest({ rawText: "えっと" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
    expect(mockCreate()).not.toHaveBeenCalled();
  });

  it("存在しないセッションは 404 を返す", async () => {
    mockFindUnique().mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ rawText: "えっと", polishedText: "今日は" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
    expect(mockCreate()).not.toHaveBeenCalled();
  });

  it("不正な JSON は 400 を返す", async () => {
    const req = new Request("http://localhost/api/sessions/abc/segments", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });
});
