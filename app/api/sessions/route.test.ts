// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    talkSession: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("POST /api/sessions", () => {
  it("セッションを作成して 201 と id を返す", async () => {
    const mockCreate = vi.mocked(prisma.talkSession.create);
    mockCreate.mockResolvedValueOnce({
      id: "test123",
      status: "BEFORE",
      createdAt: new Date(),
    } as never);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("id", "test123");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("生成される id は文字列である", async () => {
    const mockCreate = vi.mocked(prisma.talkSession.create);
    mockCreate.mockResolvedValueOnce({ id: "dummy", status: "BEFORE", createdAt: new Date() } as never);

    const res = await POST();
    const body = await res.json();

    // create に渡された id が文字列であることを確認
    const calledWith = mockCreate.mock.calls[0][0] as { data: { id: string } };
    expect(typeof calledWith.data.id).toBe("string");
    expect(calledWith.data.id.length).toBeGreaterThan(0);
    expect(body.id).toBe("dummy");
  });
});
