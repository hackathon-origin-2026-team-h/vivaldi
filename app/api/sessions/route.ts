import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

function generateSessionId(): string {
  return randomUUID();
}

export async function POST(_request: Request) {
  const id = generateSessionId();
  const session = await prisma.talkSession.create({ data: { id } });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
