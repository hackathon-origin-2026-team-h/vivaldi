// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockStub = { fetch: vi.fn() };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => Promise.resolve({ env: {} })),
}));

vi.mock("@/lib/session", () => ({
  getSessionStub: vi.fn(() => mockStub),
}));

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStub.fetch.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("セッションを作成して 201 と id を返す", async () => {
    const res = await POST();
    const body = (await res.json()) as { id: string };

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("id");
  });

  it("生成される id は文字列である", async () => {
    const res = await POST();
    const body = (await res.json()) as { id: string };

    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });
});
