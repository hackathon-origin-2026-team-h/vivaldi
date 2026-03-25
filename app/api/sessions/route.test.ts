// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/pubsub", () => ({
  createSession: vi.fn(),
}));

import { createSession } from "@/lib/pubsub";

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("セッションを作成して 201 と id を返す", async () => {
    vi.mocked(createSession).mockReturnValueOnce({
      id: "test123",
      status: "BEFORE",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("id", "test123");
    expect(createSession).toHaveBeenCalledOnce();
  });

  it("生成される id は文字列である", async () => {
    vi.mocked(createSession).mockReturnValueOnce({
      id: "dummy",
      status: "BEFORE",
      createdAt: new Date(),
      segments: [],
      nextSegmentId: 1,
    });

    const res = await POST();
    const body = await res.json();

    const calledWith = vi.mocked(createSession).mock.calls[0][0];
    expect(typeof calledWith).toBe("string");
    expect(calledWith.length).toBeGreaterThan(0);
    expect(body.id).toBe("dummy");
  });
});
