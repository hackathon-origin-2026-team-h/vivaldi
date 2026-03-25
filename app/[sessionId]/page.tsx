"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

type SessionStatus = "BEFORE" | "DURING" | "AFTER";

type DisplaySegment = {
  id: number;
  polishedText: string;
  personalizedText: string | null;
  isFeedbackPending: boolean;
  feedbackDone: boolean;
  feedbackError: boolean;
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

async function fetchPersonalized(text: string, userPersona: UserPersona): Promise<string> {
  try {
    const res = await fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userPersona }),
    });
    if (!res.ok) return text;
    const body = (await res.json()) as { personalized?: string };
    return body.personalized ?? text;
  } catch {
    return text;
  }
}

export default function AttendeePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const personaRef = useRef<UserPersona>(defaultPersona);

  // Load persona from localStorage after mount
  useEffect(() => {
    personaRef.current = loadPersona();
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/stream`);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as
        | { type: "session"; status: SessionStatus }
        | { type: "segment"; id: number; polishedText: string; rawText: string };

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
              isFeedbackPending: false,
              feedbackDone: false,
              feedbackError: false,
            },
          ];
        });
        // Personalize in background
        const currentPersona = personaRef.current;
        void fetchPersonalized(polishedText, currentPersona).then((personalizedText) => {
          setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, personalizedText } : s)));
        });
      }
    };

    es.onerror = () => {
      // Close the stream on error, then check if the session actually exists.
      es.close();
      void fetch(`/api/sessions/${sessionId}`)
        .then((res) => {
          if (res.status === 404) {
            setNotFound(true);
          }
        })
        .catch(() => {
          // Treat network/server errors as transient: do not mark as notFound here.
        });
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  const handleFeedback = useCallback(async (segmentId: number, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, isFeedbackPending: true } : s)));

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, userPersona: personaRef.current }),
      });
      if (res.ok) {
        const body = (await res.json()) as { updatedPersona: UserPersona };
        personaRef.current = body.updatedPersona;
        savePersona(body.updatedPersona);
        setSegments((prev) =>
          prev.map((s) => (s.id === segmentId ? { ...s, isFeedbackPending: false, feedbackDone: true } : s)),
        );
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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">リアルタイム意訳</h1>
          {sessionStatus && (
            <span
              className={[
                "px-2.5 py-0.5 rounded-full text-xs font-medium",
                sessionStatus === "BEFORE"
                  ? "bg-gray-100 text-gray-600"
                  : sessionStatus === "DURING"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700",
              ].join(" ")}
            >
              {sessionStatus === "BEFORE" && "発表前"}
              {sessionStatus === "DURING" && "発表中"}
              {sessionStatus === "AFTER" && "発表終了"}
            </span>
          )}
        </div>

        {(sessionStatus === null || sessionStatus === "BEFORE") && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-lg">●</span>
            </div>
            <p className="text-gray-500 font-medium">発表開始をお待ちください</p>
          </div>
        )}

        {sessionStatus === "DURING" && segments.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">まもなくテキストが表示されます…</p>
          </div>
        )}

        {segments.length > 0 && (
          <div className="space-y-3">
            {segments.map((seg) => (
              <div key={seg.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-base leading-relaxed text-gray-900">{seg.personalizedText ?? seg.polishedText}</p>
                {seg.personalizedText === null && <p className="text-xs text-gray-400 mt-1">意訳中…</p>}
                {!seg.feedbackDone && (
                  <button
                    type="button"
                    disabled={seg.isFeedbackPending}
                    onClick={() => void handleFeedback(seg.id, seg.personalizedText ?? seg.polishedText)}
                    className={[
                      "mt-3 text-xs px-3 py-1 rounded-full border transition-colors",
                      seg.isFeedbackPending
                        ? "border-gray-200 text-gray-300 cursor-not-allowed"
                        : "border-gray-300 text-gray-500 hover:border-orange-300 hover:text-orange-600",
                    ].join(" ")}
                  >
                    {seg.isFeedbackPending ? "送信中…" : "わかりにくい"}
                  </button>
                )}
                {seg.feedbackDone && (
                  <span className="mt-3 inline-block text-xs text-orange-500">フィードバックを送りました</span>
                )}
                {seg.feedbackError && (
                  <span className="mt-3 inline-block text-xs text-red-500">
                    送信に失敗しました。もう一度お試しください
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {sessionStatus === "AFTER" && segments.length > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">発表が終了しました</p>
        )}
      </div>
    </main>
  );
}
