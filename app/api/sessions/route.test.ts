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

    const req = new Request("http://localhost/api/sessions", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("id", "test123");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("生成される id は文字列である", async () => {
    const mockCreate = vi.mocked(prisma.talkSession.create);
    mockCreate.mockImplementationOnce(async ({ data }) => ({
      id: data.id as string,
      status: "BEFORE",
      createdAt: new Date(),
    }));

    const req = new Request("http://localhost/api/sessions", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });
});
