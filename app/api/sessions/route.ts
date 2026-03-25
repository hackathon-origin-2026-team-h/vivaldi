import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function POST(_request: Request) {
  const id = generateSessionId();
  const session = await prisma.talkSession.create({ data: { id } });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
