import { extractText, getClient } from "@/lib/claude";

export async function polishTranscript(rawText: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下は音声認識で得られた日本語の書き起こしテキストです。誤認識や言い淀み、繰り返しを修正し、自然で読みやすい文章に整えてください。内容は変えずに表現だけ改善してください。修正後のテキストのみを返してください。\n\n${rawText}`,
      },
    ],
  });

  const text = extractText(response);
  return text !== "" ? text : rawText;
}
