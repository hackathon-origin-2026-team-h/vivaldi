import { DefaultDeepgramClient } from "@deepgram/sdk";

function createDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }
  return new DefaultDeepgramClient({ apiKey });
}

const globalForDeepgram = globalThis as unknown as { deepgram: DefaultDeepgramClient };

export const deepgram = globalForDeepgram.deepgram ?? createDeepgramClient();

if (process.env.NODE_ENV !== "production") globalForDeepgram.deepgram = deepgram;
