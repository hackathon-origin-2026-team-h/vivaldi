import { NextResponse } from "next/server";
import * as v from "valibot";
import { parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.talkSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ id: session.id, status: session.status });
}

const PatchBodySchema = v.object({
  status: v.picklist(["DURING", "AFTER"], "status must be one of: DURING, AFTER"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await parseBody(request, PatchBodySchema);
  if (!result.ok) return result.response;

  const session = await prisma.talkSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updated = await prisma.talkSession.update({
    where: { id },
    data: { status: result.data.status },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
