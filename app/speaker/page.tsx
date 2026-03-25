"use client";

import { DeepgramClient } from "@deepgram/sdk";
import { Kosugi_Maru } from "next/font/google";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

const kosugiMaru = Kosugi_Maru({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

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

// AudioContext with createScriptProcessor support
interface AudioContextWithScriptProcessor extends AudioContext {
  createScriptProcessor(
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number,
  ): ScriptProcessorNode;
}

export default function SpeakerPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [audienceUrl, setAudienceUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const socketRef = useRef<{ sendMedia: (d: ArrayBufferLike) => void; close: () => void } | null>(null);
  const idCounterRef = useRef(0);
  const lastInterimIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Create session on mount
  useEffect(() => {
    void fetch("/api/sessions", { method: "POST" })
      .then((res) => res.json())
      .then(async (body) => {
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
          const processor = (audioCtx as AudioContextWithScriptProcessor).createScriptProcessor(4096, 1, 1);
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
            lastInterimIdRef.current = newId;
            return [...prev, { id: newId, text: transcript, isFinal: false }];
          }

          if (lastInterimIdx !== -1) {
            const next = [...prev];
            next[lastInterimIdx] = { ...next[lastInterimIdx], text: transcript, isFinal: true };
            return next;
          }

          return [...prev, { id: newId, text: transcript, isFinal: true }];
        });

        if (data.is_final) {
          const targetId = lastInterimIdRef.current ?? newId;
          lastInterimIdRef.current = null;
          const sid = sessionIdRef.current;
          void fetchPolished(transcript).then((polished) => {
            setSegments((s) => s.map((seg) => (seg.id === targetId ? { ...seg, polished } : seg)));
            if (sid) void postSegment(sid, transcript, polished);
          });
        }
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

  const handleCopyUrl = useCallback(async () => {
    if (!audienceUrl) return;
    try {
      await navigator.clipboard.writeText(audienceUrl);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      // fallback: silently ignore clipboard errors
    }
  }, [audienceUrl]);

  const isRecording = status === "recording";
  const isConnecting = status === "connecting";
  const isIdle = status === "idle";

  return (
    <main
      className={`${kosugiMaru.className} min-h-screen flex flex-col items-center px-5 py-10`}
      style={{ backgroundColor: "#FFF4E5" }}
    >
      <div className="max-w-sm w-full mx-auto flex flex-col items-center gap-7">
        {/* ── Header with icon ── */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: "#E98527", letterSpacing: "0.2em" }}>
            発表者コントロール
          </h1>
          <p className="text-xs text-stone-500 text-center">QRコードを参加者に共有して、発表を開始しましょう</p>
        </div>

        {/* ── QR Code card ── */}
        <div
          className="w-full rounded-2xl p-6 flex flex-col items-center gap-4 shadow-sm"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #F0D9B5" }}
        >
          <p className="text-xs font-bold tracking-wide" style={{ color: "#E98527" }}>
            参加者用 QR コード
          </p>

          {qrDataUrl ? (
            // biome-ignore lint/performance/noImgElement: QR code data URL cannot use next/image
            <img src={qrDataUrl} alt="参加者用QRコード" width={180} height={180} className="rounded-xl" />
          ) : (
            <div
              className="w-[180px] h-[180px] rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FFF4E5" }}
            >
              <span className="text-stone-400 text-sm">生成中…</span>
            </div>
          )}

          {/* Copy URL button */}
          <button
            type="button"
            onClick={() => void handleCopyUrl()}
            disabled={!audienceUrl}
            className={[
              "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
              audienceUrl
                ? copied
                  ? "text-white shadow-md"
                  : "text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                : "text-stone-400 cursor-not-allowed",
            ].join(" ")}
            style={
              audienceUrl
                ? copied
                  ? { backgroundColor: "#4ade80" }
                  : { backgroundColor: "#E98527" }
                : { backgroundColor: "#E8DCC8" }
            }
          >
            {copied ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <title>コピー完了</title>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                コピーしました
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <title>URLをコピー</title>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                参加者URLをコピー
              </>
            )}
          </button>

          <p className="text-xs text-stone-400 text-center leading-relaxed">
            書き起こされた文章はこのリンク先で参加者に公開されます
          </p>
        </div>

        {/* ── Status indicator ── */}
        <div
          className="w-full rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors"
          style={
            isRecording
              ? { backgroundColor: "#FEE2E2", border: "1px solid #FECACA" }
              : isConnecting
                ? { backgroundColor: "#FFECD2", border: "1px solid #F0D9B5" }
                : { backgroundColor: "#FFFFFF", border: "1px solid #F0D9B5" }
          }
        >
          {/* Animated dot */}
          <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
            {isRecording && (
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-50 animate-ping" />
            )}
            {isConnecting && (
              <span
                className="absolute inline-flex w-full h-full rounded-full opacity-40 animate-pulse"
                style={{ backgroundColor: "#E98527" }}
              />
            )}
            <span
              className="relative inline-flex w-5 h-5 rounded-full"
              style={
                isRecording
                  ? { backgroundColor: "#EF4444" }
                  : isConnecting
                    ? { backgroundColor: "#E98527" }
                    : { backgroundColor: "#D6CFC4" }
              }
            />
          </div>
          <div>
            <p
              className="text-sm font-bold"
              style={isRecording ? { color: "#B91C1C" } : isConnecting ? { color: "#C06A10" } : { color: "#78716C" }}
            >
              {isRecording ? "発表中" : isConnecting ? "接続中…" : "待機中"}
            </p>
            <p
              className="text-xs mt-0.5"
              style={isRecording ? { color: "#DC2626" } : isConnecting ? { color: "#E98527" } : { color: "#A8A29E" }}
            >
              {isRecording
                ? "音声をリアルタイムで書き起こしています"
                : isConnecting
                  ? "マイクとサーバーに接続しています"
                  : "「発表開始」を押すと配信が始まります"}
            </p>
          </div>
        </div>

        {/* ── Error ── */}
        {error !== null && (
          <div
            className="w-full p-4 rounded-2xl text-sm"
            style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA", color: "#B91C1C" }}
          >
            {error}
          </div>
        )}

        {/* ── Start / Stop button ── */}
        <button
          type="button"
          onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
          disabled={isConnecting || !sessionId}
          className={[
            "w-full py-4 rounded-full font-bold text-base text-white transition-all shadow-lg",
            isRecording
              ? "hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              : isConnecting || !sessionId
                ? "cursor-not-allowed"
                : "hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
          ].join(" ")}
          style={
            isRecording
              ? { backgroundColor: "#EF4444" }
              : isConnecting || !sessionId
                ? { backgroundColor: "#D6CFC4" }
                : { backgroundColor: "#E98527" }
          }
        >
          {isConnecting ? "接続中…" : isRecording ? "発表を終了する" : "発表を開始する"}
        </button>

        {/* ── Segment count hint ── */}
        {segments.length > 0 && isIdle && (
          <p className="text-xs text-stone-400 text-center">{segments.length} 件の書き起こしが参加者に配信されました</p>
        )}

        {/* ── Footer ── */}
        <p className="text-xs text-stone-400 text-center pb-4">fumumu — ふむふむから、わかったへ。</p>
      </div>
    </main>
  );
}
