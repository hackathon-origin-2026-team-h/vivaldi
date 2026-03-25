"use client";

import { DeepgramClient } from "@deepgram/sdk";
import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

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

async function patchSessionStatus(sessionId: string, status: "DURING" | "AFTER"): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    console.error("Failed to update session status:", err);
  }
}

async function postSegment(sessionId: string, rawText: string, polishedText: string): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, polishedText }),
    });
  } catch (err) {
    console.error("Failed to post segment:", err);
  }
}

export default function SpeakerPageClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [audienceUrl, setAudienceUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const socketRef = useRef<{ sendMedia: (d: ArrayBufferLike) => void; close: () => void } | null>(null);
  const idCounterRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    void fetch("/api/sessions", { method: "POST" })
      .then((res) => res.json())
      .then(async (body: unknown) => {
        const { id } = body as { id: string };
        setSessionId(id);
        sessionIdRef.current = id;

        const url = `${window.location.origin}/${id}`;
        setAudienceUrl(url);

        const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
        setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error("Failed to create session:", err);
      });
  }, []);

  const stopRecording = useCallback(async () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("idle");

    if (sessionIdRef.current) {
      await patchSessionStatus(sessionIdRef.current, "AFTER");
    }
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

          if (sessionIdRef.current) {
            void patchSessionStatus(sessionIdRef.current, "DURING");
          }

          const audioCtx = new AudioContext({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
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
          void stopRecording();
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
            const targetId = next[lastInterimIdx].id;
            const sid = sessionIdRef.current;
            void fetchPolished(transcript).then((polished) => {
              setSegments((s) => s.map((seg) => (seg.id === targetId ? { ...seg, polished } : seg)));
              if (sid) void postSegment(sid, transcript, polished);
            });
            return next;
          }

          const sid = sessionIdRef.current;
          void fetchPolished(transcript).then((polished) => {
            setSegments((s) => s.map((seg) => (seg.id === newId ? { ...seg, polished } : seg)));
            if (sid) void postSegment(sid, transcript, polished);
          });
          return [...prev, { id: newId, text: transcript, isFinal: true }];
        });
      });

      socket.on("error", (err) => {
        setError(`接続エラー: ${err.message}`);
        void stopRecording();
      });

      socket.on("close", () => {
        setStatus("idle");
      });

      socket.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
      void stopRecording();
    }
  }, [stopRecording]);

  const isRecording = status === "recording";
  const isConnecting = status === "connecting";

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">音声書き起こし</h1>
        <p className="mb-8 text-sm text-gray-500">マイクからの音声をリアルタイムで文字起こしします</p>

        {sessionId && (
          <div className="mb-6 flex flex-col items-center gap-6 rounded-xl border border-gray-200 bg-white p-6 sm:flex-row">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="QR code for audience"
                width={128}
                height={128}
                className="shrink-0"
                unoptimized
              />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                生成中…
              </div>
            )}
            <div className="min-w-0">
              <p className="mb-1 text-sm font-medium text-gray-700">聴講者URL</p>
              {audienceUrl && <p className="break-all font-mono text-xs text-gray-500">{audienceUrl}</p>}
              <p className="mt-2 text-xs text-gray-400">このQRコードを聴講者にスキャンしてもらってください</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
            disabled={isConnecting || !sessionId}
            className={[
              "rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors",
              isRecording
                ? "bg-red-500 hover:bg-red-600"
                : isConnecting || !sessionId
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-blue-500 hover:bg-blue-600",
            ].join(" ")}
          >
            {isConnecting ? "接続中…" : isRecording ? "録音停止" : "録音開始"}
          </button>

          <div className="flex items-center gap-2">
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                isRecording ? "animate-pulse bg-red-500" : isConnecting ? "animate-pulse bg-yellow-400" : "bg-gray-300",
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="min-h-48 rounded-xl border border-gray-200 bg-white p-6">
          {segments.length === 0 ? (
            <p className="pt-8 text-center text-sm text-gray-400">「録音開始」を押すと書き起こしがここに表示されます</p>
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
            className="mt-3 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            クリア
          </button>
        )}
      </div>
    </main>
  );
}
