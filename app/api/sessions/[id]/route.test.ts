// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockStub = { fetch: vi.fn() };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => Promise.resolve({ env: {} })),
}));

vi.mock("@/lib/session", () => ({
  getSessionStub: vi.fn(() => mockStub),
}));

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
    mockStub.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc", status: "DURING" }), { status: 200 }),
    );

    const res = await PATCH(makeRequest({ status: "DURING" }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "abc", status: "DURING" });
  });

  it("AFTER に更新できる", async () => {
    mockStub.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: "abc", status: "AFTER" }), { status: 200 }));

    const res = await PATCH(makeRequest({ status: "AFTER" }), params);
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("AFTER");
  });

  it("不正な status は 400 を返す", async () => {
    const res = await PATCH(makeRequest({ status: "INVALID" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
    expect(mockStub.fetch).not.toHaveBeenCalled();
  });

  it("status なしは 400 を返す", async () => {
    const res = await PATCH(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it("存在しないセッションは 404 を返す", async () => {
    mockStub.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

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
