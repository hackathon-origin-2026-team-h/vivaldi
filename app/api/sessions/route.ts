import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await prisma.talkSession.create({ data: { id: randomUUID() } });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
