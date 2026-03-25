import { deepgram } from "@/lib/deepgram";
import { NextResponse } from "next/server";

// Returns a short-lived JWT (30 seconds TTL) for client-side WebSocket connections.
// The client uses this token to connect directly to Deepgram's real-time transcription
// WebSocket without exposing the primary API key.
//
// Client WebSocket URL:
//   wss://api.deepgram.com/v1/listen?model=nova-3&language=ja&...
// Authorization header:
//   token <access_token>
export async function POST() {
  try {
    const response = await deepgram.auth.v1.tokens.grant();
    return NextResponse.json({ token: response.access_token });
  } catch {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}
