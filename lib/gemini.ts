import { GoogleGenAI } from "@google/genai";

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

const globalForGemini = globalThis as unknown as { gemini: GoogleGenAI };

export const gemini = globalForGemini.gemini ?? createGeminiClient();

if (process.env.NODE_ENV !== "production") globalForGemini.gemini = gemini;

export async function polishTranscript(rawText: string): Promise<string> {
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `以下は音声認識で得られた日本語の書き起こしテキストです。誤認識や言い淀み、繰り返しを修正し、自然で読みやすい文章に整えてください。内容は変えずに表現だけ改善してください。修正後のテキストのみを返してください。\n\n${rawText}`,
          },
        ],
      },
    ],
  });

  return response.text ?? rawText;
}
