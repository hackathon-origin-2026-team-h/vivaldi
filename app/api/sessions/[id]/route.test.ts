// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    talkSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = () => vi.mocked(prisma.talkSession.findUnique);
const mockUpdate = () => vi.mocked(prisma.talkSession.update);

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/sessions/abc", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = { params: { id: "abc" } };

describe("PATCH /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DURING に更新できる", async () => {
    mockFindUnique().mockResolvedValueOnce({
      id: "abc",
      status: "BEFORE",
      createdAt: new Date(),
    } as never);
    mockUpdate().mockResolvedValueOnce({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
    } as never);

    const res = await PATCH(makeRequest({ status: "DURING" }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "abc", status: "DURING" });
  });

  it("AFTER に更新できる", async () => {
    mockFindUnique().mockResolvedValueOnce({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
    } as never);
    mockUpdate().mockResolvedValueOnce({
      id: "abc",
      status: "AFTER",
      createdAt: new Date(),
    } as never);

    const res = await PATCH(makeRequest({ status: "AFTER" }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("AFTER");
  });

  it("不正な status は 400 を返す", async () => {
    const res = await PATCH(makeRequest({ status: "INVALID" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
    expect(mockUpdate()).not.toHaveBeenCalled();
  });

  it("status なしは 400 を返す", async () => {
    const res = await PATCH(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it("存在しないセッションは 404 を返す", async () => {
    mockFindUnique().mockResolvedValueOnce(null);

    const res = await PATCH(makeRequest({ status: "DURING" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
    expect(mockUpdate()).not.toHaveBeenCalled();
  });

  it("不正な JSON は 400 を返す", async () => {
    const req = new Request("http://localhost/api/sessions/abc", {
      method: "PATCH",
      body: "not json",
    });
    const res = await PATCH(req, params);
    expect(res.status).toBe(400);
  });
});
