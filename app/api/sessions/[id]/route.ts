import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["DURING", "AFTER"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body;
  if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const session = await prisma.talkSession.findUnique({
    where: { id: params.id },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updated = await prisma.talkSession.update({
    where: { id: params.id },
    data: { status: status as ValidStatus },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
