import { NextResponse } from "next/server";
import { deepgram } from "@/lib/deepgram";

export async function POST() {
  try {
    const response = await deepgram.auth.v1.tokens.grant({ ttl: 30 });
    return NextResponse.json({ token: response.access_token });
  } catch {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}
