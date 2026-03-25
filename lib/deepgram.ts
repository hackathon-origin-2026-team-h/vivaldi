import { DefaultDeepgramClient } from "@deepgram/sdk";

if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY is not set");
}

function createDeepgramClient() {
  return new DefaultDeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
}

const globalForDeepgram = globalThis as unknown as { deepgram: DefaultDeepgramClient };

export const deepgram = globalForDeepgram.deepgram ?? createDeepgramClient();

if (process.env.NODE_ENV !== "production") globalForDeepgram.deepgram = deepgram;
