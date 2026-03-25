"use client";

import { DeepgramClient } from "@deepgram/sdk";
import { useCallback, useRef, useState } from "react";

type Status = "idle" | "connecting" | "recording";

type TranscriptSegment = {
  id: number;
  text: string;
  isFinal: boolean;
  polished?: string;
};

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16;
}

async function fetchPolished(text: string): Promise<string> {
  try {
    const res = await fetch("/api/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    const body = (await res.json()) as { polished?: string };
    return body.polished ?? text;
  } catch (err) {
    console.error("Failed to fetch polished text:", err);
    return text;
  }
}

export default function SpeakerPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const socketRef = useRef<{ sendMedia: (d: ArrayBufferLike) => void; close: () => void } | null>(null);
  const idCounterRef = useRef(0);

  const stopRecording = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("idle");
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      const res = await fetch("/api/transcribe/token", { method: "POST" });
      if (!res.ok) throw new Error("トークンの取得に失敗しました");
      const body = (await res.json()) as { token?: string; error?: string };
      if (body.error || !body.token) throw new Error(body.error ?? "トークンがありません");
      const token = body.token;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const client = new DeepgramClient({ apiKey: token });

      // Authorization in args is required by the auto-generated type but is not used at
      // runtime by the wrapped client—auth comes from the apiKey above.
      const socket = await client.listen.v1.connect({
        model: "nova-3",
        language: "ja",
        smart_format: "true",
        interim_results: "true",
        encoding: "linear16",
        sample_rate: 16000,
        Authorization: `Token ${token}`,
        reconnectAttempts: 0,
      });

      socketRef.current = socket;

      socket.on("open", () => {
        try {
          setStatus("recording");

          const audioCtx = new AudioContext({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          // ScriptProcessorNode is deprecated but broadly supported; AudioWorklet requires
          // a separate worker file which adds complexity for this use case.
          // biome-ignore lint/suspicious/noExplicitAny: ScriptProcessor type lacks createScriptProcessor signature in some lib versions
          const processor = (audioCtx as unknown as any).createScriptProcessor(4096, 1, 1) as ScriptProcessorNode;
          processorRef.current = processor;

          processor.onaudioprocess = (e: AudioProcessingEvent) => {
            const channelData = e.inputBuffer.getChannelData(0);
            const int16 = float32ToInt16(channelData);
            socket.sendMedia(int16.buffer);
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch (error) {
          console.error("Failed to initialize audio processing after socket open:", error);
          setError(error instanceof Error ? error.message : "An error occurred while initializing audio recording.");
          stopRecording();
        }
      });

      socket.on("message", (data) => {
        if (data.type !== "Results") return;
        const transcript = data.channel.alternatives[0]?.transcript ?? "";
        if (!transcript.trim()) return;

        const newId = idCounterRef.current + 1;
        idCounterRef.current = newId;

        setSegments((prev) => {
          const lastInterimIdx = prev.findLastIndex((s) => !s.isFinal);

          if (!data.is_final) {
            if (lastInterimIdx !== -1) {
              const next = [...prev];
              next[lastInterimIdx] = { ...next[lastInterimIdx], text: transcript };
              return next;
            }
            return [...prev, { id: newId, text: transcript, isFinal: false }];
          }

          if (lastInterimIdx !== -1) {
            const next = [...prev];
            next[lastInterimIdx] = { ...next[lastInterimIdx], text: transcript, isFinal: true };
            // Polish in the background
            const targetId = next[lastInterimIdx].id;
            void fetchPolished(transcript).then((polished) => {
              setSegments((s) => s.map((seg) => (seg.id === targetId ? { ...seg, polished } : seg)));
            });
            return next;
          }

          // Polish in the background
          void fetchPolished(transcript).then((polished) => {
            setSegments((s) => s.map((seg) => (seg.id === newId ? { ...seg, polished } : seg)));
          });
          return [...prev, { id: newId, text: transcript, isFinal: true }];
        });
      });

      socket.on("error", (err) => {
        setError(`接続エラー: ${err.message}`);
        stopRecording();
      });

      socket.on("close", () => {
        setStatus("idle");
      });

      socket.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
      stopRecording();
    }
  }, [stopRecording]);

  const isRecording = status === "recording";
  const isConnecting = status === "connecting";

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">音声書き起こし</h1>
        <p className="text-sm text-gray-500 mb-8">マイクからの音声をリアルタイムで文字起こしします</p>

        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={isRecording ? stopRecording : () => void startRecording()}
            disabled={isConnecting}
            className={[
              "px-6 py-2.5 rounded-lg font-semibold text-white text-sm transition-colors",
              isRecording
                ? "bg-red-500 hover:bg-red-600"
                : isConnecting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600",
            ].join(" ")}
          >
            {isConnecting ? "接続中…" : isRecording ? "録音停止" : "録音開始"}
          </button>

          <div className="flex items-center gap-2">
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                isRecording ? "bg-red-500 animate-pulse" : isConnecting ? "bg-yellow-400 animate-pulse" : "bg-gray-300",
              ].join(" ")}
            />
            <span className="text-sm text-gray-600">
              {status === "idle" && "待機中"}
              {status === "connecting" && "接続中"}
              {status === "recording" && "録音中"}
            </span>
          </div>
        </div>

        {error !== null && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 min-h-48 p-6">
          {segments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">「録音開始」を押すと書き起こしがここに表示されます</p>
          ) : (
            <div className="space-y-1">
              {segments.map((seg) => (
                <p
                  key={seg.id}
                  className={`text-base leading-relaxed ${seg.isFinal ? "text-gray-900" : "text-gray-400"}`}
                >
                  {seg.isFinal ? (seg.polished ?? seg.text) : seg.text}
                </p>
              ))}
            </div>
          )}
        </div>

        {segments.length > 0 && (
          <button
            type="button"
            onClick={() => setSegments([])}
            className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            クリア
          </button>
        )}
      </div>
    </main>
  );
}
