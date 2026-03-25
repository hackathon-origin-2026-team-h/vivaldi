// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/pubsub", () => ({
  getSession: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

import { updateSessionStatus } from "@/lib/pubsub";

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/sessions/abc", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ id: "abc" }) };

describe("PATCH /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DURING に更新できる", async () => {
    vi.mocked(updateSessionStatus).mockReturnValueOnce({
      id: "abc",
      status: "DURING",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });

    const res = await PATCH(makeRequest({ status: "DURING" }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "abc", status: "DURING" });
  });

  it("AFTER に更新できる", async () => {
    vi.mocked(updateSessionStatus).mockReturnValueOnce({
      id: "abc",
      status: "AFTER",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });

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
    expect(updateSessionStatus).not.toHaveBeenCalled();
  });

  it("status なしは 400 を返す", async () => {
    const res = await PATCH(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it("存在しないセッションは 404 を返す", async () => {
    vi.mocked(updateSessionStatus).mockReturnValueOnce(null);

    const res = await PATCH(makeRequest({ status: "DURING" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error");
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
