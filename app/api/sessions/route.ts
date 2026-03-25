import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/pubsub";

export async function POST() {
  const session = createSession(randomUUID());
  return NextResponse.json({ id: session.id }, { status: 201 });
}
