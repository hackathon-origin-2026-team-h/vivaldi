import { NextResponse } from "next/server";
import { deepgram } from "@/lib/deepgram";

export async function POST() {
  try {
    const response = await deepgram.auth.v1.tokens.grant({ ttl_seconds: 30 });
    return NextResponse.json({ token: response.access_token });
  } catch (error) {
    console.error("Failed to create Deepgram token", error);
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}
