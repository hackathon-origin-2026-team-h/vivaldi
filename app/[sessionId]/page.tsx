"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

type SessionStatus = "BEFORE" | "DURING" | "AFTER";

// "loading" = personalization in progress
// "done"    = personalization finished (personalizedText holds result)
// "failed"  = API error; showing polishedText as fallback
type PersonalizationState = "loading" | "done" | "failed";

type DisplaySegment = {
  id: number;
  polishedText: string;
  personalizedText: string | null;
  personalizationState: PersonalizationState;
  isFeedbackPending: boolean;
  feedbackDone: boolean;
  feedbackError: boolean;
  showOriginal: boolean;
  feedbackInference: string | null;
  isRepersonalizing: boolean;
};

const PERSONA_KEY = "vivaldi:userPersona";

function loadPersona(): UserPersona {
  if (typeof window === "undefined") return defaultPersona;
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) return defaultPersona;
    return parsePersona(JSON.parse(raw));
  } catch {
    return defaultPersona;
  }
}

function savePersona(persona: UserPersona): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_KEY, JSON.stringify(persona));
}

// Returns { text, failed }
async function fetchPersonalized(text: string, userPersona: UserPersona): Promise<{ text: string; failed: boolean }> {
  try {
    const res = await fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userPersona }),
    });
    if (!res.ok) return { text, failed: true };
    const body = (await res.json()) as { personalized?: string };
    return { text: body.personalized ?? text, failed: false };
  } catch {
    return { text, failed: true };
  }
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

export default function AttendeePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const personaRef = useRef<UserPersona>(defaultPersona);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    personaRef.current = loadPersona();
  }, []);

  // Auto-scroll when a new segment arrives
  useEffect(() => {
    if (segments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [segments.length]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/stream`);

    es.onmessage = (event) => {
      let data:
        | { type: "session"; status: SessionStatus }
        | { type: "segment"; id: number; polishedText: string; rawText: string };
      try {
        data = JSON.parse(event.data as string) as typeof data;
      } catch {
        return;
      }

      if (data.type === "session") {
        setSessionStatus(data.status);
      } else if (data.type === "segment") {
        const { id, polishedText } = data;
        setSegments((prev) => {
          if (prev.some((s) => s.id === id)) return prev;
          return [
            ...prev,
            {
              id,
              polishedText,
              personalizedText: null,
              personalizationState: "loading",
              isFeedbackPending: false,
              feedbackDone: false,
              feedbackError: false,
              showOriginal: false,
              feedbackInference: null,
              isRepersonalizing: false,
            },
          ];
        });

        const currentPersona = personaRef.current;
        void fetchPersonalized(polishedText, currentPersona).then(({ text: personalizedText, failed }) => {
          setSegments((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    personalizedText,
                    personalizationState: failed ? "failed" : "done",
                  }
                : s,
            ),
          );
        });
      }
    };

    es.onerror = () => {
      es.close();
      void fetch(`/api/sessions/${sessionId}`)
        .then((res) => {
          if (res.status === 404) setNotFound(true);
        })
        .catch(() => {});
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  const handleFeedback = useCallback(async (segmentId: number, text: string, polishedText: string) => {
    setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, isFeedbackPending: true } : s)));
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, userPersona: personaRef.current }),
      });
      if (res.ok) {
        const body = (await res.json()) as { updatedPersona: UserPersona; inference: string };
        personaRef.current = body.updatedPersona;
        savePersona(body.updatedPersona);
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? {
                  ...s,
                  isFeedbackPending: false,
                  feedbackDone: true,
                  feedbackInference: body.inference,
                  isRepersonalizing: true,
                }
              : s,
          ),
        );
        // Re-personalize with updated persona reflecting the feedback
        void fetchPersonalized(polishedText, body.updatedPersona).then(({ text: newText, failed }) => {
          if (!failed) {
            setSegments((prev) =>
              prev.map((s) =>
                s.id === segmentId
                  ? { ...s, personalizedText: newText, personalizationState: "done", isRepersonalizing: false }
                  : s,
              ),
            );
          } else {
            setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, isRepersonalizing: false } : s)));
          }
        });
      } else {
        setSegments((prev) =>
          prev.map((s) => (s.id === segmentId ? { ...s, isFeedbackPending: false, feedbackError: true } : s)),
        );
      }
    } catch {
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, isFeedbackPending: false, feedbackError: true } : s)),
      );
    }
  }, []);

  const toggleOriginal = useCallback((segmentId: number) => {
    setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, showOriginal: !s.showOriginal } : s)));
  }, []);

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg text-gray-500">セッションが見つかりません</p>
          <p className="text-sm text-gray-400 mt-2">URLを確認してください</p>
        </div>
      </main>
    );
  }

  const isLive = sessionStatus === "DURING";
  const latestSegmentId = segments.at(-1)?.id;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">リアルタイム意訳</h1>
          {sessionStatus && (
            <span
              className={[
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                sessionStatus === "BEFORE"
                  ? "bg-gray-100 text-gray-600"
                  : sessionStatus === "DURING"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700",
              ].join(" ")}
            >
              {isLive && <LiveDot />}
              {sessionStatus === "BEFORE" && "発表前"}
              {sessionStatus === "DURING" && "配信中"}
              {sessionStatus === "AFTER" && "発表終了"}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {/* Waiting for session to start */}
        {(sessionStatus === null || sessionStatus === "BEFORE") && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mt-4">
            <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-2xl">○</span>
            </div>
            <p className="text-gray-600 font-medium">発表開始をお待ちください</p>
            <p className="text-sm text-gray-400 mt-1">発表が始まると自動的にテキストが表示されます</p>
          </div>
        )}

        {/* Live but no segments yet */}
        {isLive && segments.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mt-4">
            <div className="flex justify-center gap-1.5 mb-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-green-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-gray-500 text-sm">まもなくテキストが表示されます…</p>
          </div>
        )}

        {/* Segment list */}
        {segments.length > 0 && (
          <div className="space-y-4 mt-2">
            {segments.map((seg, index) => {
              const isLatest = seg.id === latestSegmentId;
              // Always display something: personalizedText when ready, else polishedText
              const displayText = seg.personalizedText ?? seg.polishedText;
              const hasPersonalizationDiff =
                seg.personalizationState === "done" &&
                seg.personalizedText !== null &&
                seg.personalizedText !== seg.polishedText;

              return (
                <div
                  key={seg.id}
                  className={[
                    "bg-white rounded-2xl border p-5 transition-all",
                    isLatest && isLive ? "border-green-200 shadow-sm" : "border-gray-200",
                    !isLatest ? "opacity-75" : "",
                  ].join(" ")}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-300 font-mono tabular-nums select-none">#{index + 1}</span>
                    <div className="flex items-center gap-2">
                      {/* Personalization status badge */}
                      {seg.personalizationState === "loading" && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                          <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                          意訳中
                        </span>
                      )}
                      {seg.personalizationState === "done" && hasPersonalizationDiff && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">意訳済み</span>
                      )}
                      {seg.personalizationState === "failed" && (
                        <span className="text-xs text-gray-400">意訳できませんでした</span>
                      )}
                      {/* Latest indicator */}
                      {isLatest && isLive && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                          <LiveDot />
                          最新
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main text — always visible immediately */}
                  <p
                    className={[
                      "leading-relaxed text-gray-900",
                      isLatest ? "text-xl font-medium" : "text-base",
                      seg.personalizationState === "loading" ? "text-gray-500" : "",
                    ].join(" ")}
                  >
                    {displayText}
                  </p>

                  {/* Toggle to compare with original */}
                  {hasPersonalizationDiff && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleOriginal(seg.id)}
                        className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                      >
                        {seg.showOriginal ? "▲ 元のテキストを隠す" : "▼ 元のテキストを見る"}
                      </button>
                      {seg.showOriginal && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-200">
                          <p className="text-sm text-gray-400 leading-relaxed">{seg.polishedText}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback controls */}
                  {seg.personalizationState !== "loading" && (
                    <div className="mt-4">
                      {!seg.feedbackDone && !seg.feedbackError && (
                        <button
                          type="button"
                          disabled={seg.isFeedbackPending}
                          onClick={() => void handleFeedback(seg.id, displayText, seg.polishedText)}
                          className={[
                            "text-xs px-3 py-1.5 rounded-full border transition-colors",
                            seg.isFeedbackPending
                              ? "border-gray-200 text-gray-300 cursor-not-allowed"
                              : "border-orange-200 text-orange-500 hover:bg-orange-50 hover:border-orange-300",
                          ].join(" ")}
                        >
                          {seg.isFeedbackPending ? "送信中…" : "わかりにくい"}
                        </button>
                      )}
                      {seg.feedbackDone && (
                        <div className="text-xs text-orange-500 space-y-1">
                          <p>フィードバックを送りました</p>
                          {seg.feedbackInference && (
                            <p className="text-gray-400 leading-relaxed">{seg.feedbackInference}</p>
                          )}
                          {seg.isRepersonalizing && (
                            <p className="text-blue-400 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse inline-block" />
                              より分かりやすく意訳し直しています…
                            </p>
                          )}
                        </div>
                      )}
                      {seg.feedbackError && (
                        <p className="text-xs text-red-500">送信に失敗しました。もう一度お試しください</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sessionStatus === "AFTER" && segments.length > 0 && (
          <p className="mt-8 text-center text-sm text-gray-400">発表が終了しました</p>
        )}

        <div ref={bottomRef} className="h-12" />
      </main>
    </div>
  );
}
