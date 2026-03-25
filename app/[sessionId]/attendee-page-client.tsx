"use client";

import { type ReactNode, type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";
import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

const PERSONA_KEY = "vivaldi:userPersona";
const PAGE_SIZE = 5;
const LATEST_SCROLL_THRESHOLD = 72;

type SessionStatus = "BEFORE" | "DURING" | "AFTER";

type DisplaySegment = {
  id: number;
  rawText: string;
  polishedText: string;
  personalizedText: string | null;
  isPersonalizing: boolean;
};

type TranscriptPage = {
  key: string;
  segments: DisplaySegment[];
  isBlank: boolean;
};

type AttendeePageClientProps = {
  sessionId: string;
};

function loadPersona(): UserPersona {
  if (typeof window === "undefined") {
    return defaultPersona;
  }

  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) {
      return defaultPersona;
    }

    return parsePersona(JSON.parse(raw));
  } catch {
    return defaultPersona;
  }
}

async function fetchPersonalized(text: string, userPersona: UserPersona): Promise<string> {
  try {
    const response = await fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userPersona }),
    });

    if (!response.ok) {
      return text;
    }

    const body = (await response.json()) as { personalized?: string };
    return body.personalized ?? text;
  } catch {
    return text;
  }
}

function buildPages(segments: DisplaySegment[], sessionStatus: SessionStatus | null): TranscriptPage[] {
  const pages: TranscriptPage[] = [];

  for (let index = 0; index < segments.length; index += PAGE_SIZE) {
    pages.push({
      key: `page-${index / PAGE_SIZE}`,
      segments: segments.slice(index, index + PAGE_SIZE),
      isBlank: false,
    });
  }

  const shouldAppendBlankPage = segments.length > 0 && sessionStatus !== "AFTER" && segments.length % PAGE_SIZE === 0;

  if (shouldAppendBlankPage) {
    pages.push({
      key: `page-${pages.length}-blank`,
      segments: [],
      isBlank: true,
    });
  }

  return pages;
}

export default function AttendeePageClient({ sessionId }: AttendeePageClientProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const personaRef = useRef<UserPersona>(defaultPersona);
  const stickToLatestRef = useRef(true);
  const previousSegmentCountRef = useRef(0);

  const [isMounted, setIsMounted] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isAtLatest, setIsAtLatest] = useState(true);

  const transcriptPages = buildPages(segments, sessionStatus);
  const latestSegmentId = segments.at(-1)?.id ?? null;

  const syncLatestState = useEffectEvent(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nextIsAtLatest = distanceToBottom <= LATEST_SCROLL_THRESHOLD;

    stickToLatestRef.current = nextIsAtLatest;
    setIsAtLatest(nextIsAtLatest);
  });

  const jumpToLatest = useEffectEvent((behavior: ScrollBehavior) => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior,
    });

    stickToLatestRef.current = true;
    setIsAtLatest(true);
  });

  const personalizeSegment = useEffectEvent((segmentId: number, text: string) => {
    const currentPersona = personaRef.current;

    void fetchPersonalized(text, currentPersona).then((personalizedText) => {
      setSegments((current) =>
        current.map((segment) =>
          segment.id === segmentId
            ? {
                ...segment,
                personalizedText,
                isPersonalizing: false,
              }
            : segment,
        ),
      );
    });
  });

  useEffect(() => {
    setIsMounted(true);
    personaRef.current = loadPersona();
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const node = scrollRef.current;
    if (!node) {
      return;
    }

    jumpToLatest("auto");

    const handleScroll = () => {
      syncLatestState();
    };

    node.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", handleScroll);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const hasNewSegments = segments.length > previousSegmentCountRef.current;
    previousSegmentCountRef.current = segments.length;

    const shouldAdvanceToNextPage = segments.length > 0 && segments.length % PAGE_SIZE === 0;

    if (!hasNewSegments || !stickToLatestRef.current || !shouldAdvanceToNextPage) {
      return;
    }

    jumpToLatest("smooth");
  }, [isMounted, segments.length]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as
        | { type: "session"; status: SessionStatus }
        | { type: "segment"; id: number; polishedText: string; rawText: string };

      if (data.type === "session") {
        setSessionStatus(data.status);
        return;
      }

      setSegments((current) => {
        if (current.some((segment) => segment.id === data.id)) {
          return current;
        }

        return [
          ...current,
          {
            id: data.id,
            rawText: data.rawText,
            polishedText: data.polishedText,
            personalizedText: null,
            isPersonalizing: true,
          },
        ];
      });

      personalizeSegment(data.id, data.polishedText);
    };

    eventSource.onerror = () => {
      eventSource.close();

      void fetch(`/api/sessions/${sessionId}`)
        .then((response) => {
          if (response.status === 404) {
            setNotFound(true);
          }
        })
        .catch(() => {
          // Transient network errors should not show a hard 404 state.
        });
    };

    return () => {
      eventSource.close();
    };
  }, [isMounted, sessionId]);

  if (!isMounted) {
    return (
      <AttendeeViewport>
        <CenteredMessage message="発表開始までお待ちください" />
      </AttendeeViewport>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#faf4eb,#efe1d1)] px-6 py-10 text-[#20150f]">
        <div className="max-w-sm text-center">
          <p className="text-2xl font-black tracking-[-0.04em]">セッションが見つかりません</p>
          <p className="mt-3 text-sm leading-7 text-[#756457]">
            URLが正しいか、発表者がセッションを開始しているか確認してください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <AttendeeViewport
      scrollRef={scrollRef}
      showJumpToLatest={!isAtLatest && segments.length > 0}
      onJumpToLatest={() => jumpToLatest("smooth")}
    >
      {sessionStatus === null || sessionStatus === "BEFORE" ? (
        <CenteredMessage message="発表開始までお待ちください" />
      ) : sessionStatus === "DURING" && segments.length === 0 ? (
        <CenteredMessage message="まもなく翻訳を開始します" />
      ) : (
        transcriptPages.map((page, pageIndex) => (
          <TranscriptPageSection
            key={page.key}
            page={page}
            isLatestPage={pageIndex === transcriptPages.length - 1}
            latestSegmentId={latestSegmentId}
            showEndedLabel={sessionStatus === "AFTER" && pageIndex === transcriptPages.length - 1}
          />
        ))
      )}
    </AttendeeViewport>
  );
}

function AttendeeViewport({
  children,
  scrollRef,
  showJumpToLatest = false,
  onJumpToLatest,
}: {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  showJumpToLatest?: boolean;
  onJumpToLatest?: () => void;
}) {
  return (
    <main
      className="relative h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,248,237,0.95),rgba(255,248,237,0.58)_22%,transparent_48%),linear-gradient(180deg,#f7efe5_0%,#ecdcc8_45%,#e3cfbb_100%)] text-[#1f1510]"
      style={{
        fontFamily:
          '"Hiragino Maru Gothic ProN", "Hiragino Maru Gothic Pro", "YuKyokasho Yoko", "Arial Rounded MT Bold", sans-serif',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-10%] top-[-18%] h-[38vh] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85),rgba(255,255,255,0.12)_58%,transparent_72%)] blur-3xl"
      />

      <div className="relative mx-auto flex h-full w-full max-w-xl flex-col">
        <div ref={scrollRef} className="flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain">
          {children}
        </div>

        {showJumpToLatest && (
          <button
            type="button"
            className="absolute bottom-7 right-5 z-30 rounded-full border border-[#2b1e15]/10 bg-[#1f1510] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(36,22,13,0.34)] transition-transform duration-200 hover:-translate-y-0.5 sm:right-6"
            onClick={onJumpToLatest}
          >
            最新へ戻る
          </button>
        )}
      </div>
    </main>
  );
}

function TranscriptPageSection({
  page,
  isLatestPage,
  latestSegmentId,
  showEndedLabel,
}: {
  page: TranscriptPage;
  isLatestPage: boolean;
  latestSegmentId: number | null;
  showEndedLabel: boolean;
}) {
  return (
    <section className="flex h-[100svh] snap-start flex-col px-5 pb-28 pt-8 sm:px-6">
      {!page.isBlank && (
        <div className="space-y-6">
          {page.segments.map((segment) => (
            <TranscriptBlock
              key={segment.id}
              segment={segment}
              isLatestPage={isLatestPage}
              isNewestSegment={segment.id === latestSegmentId}
            />
          ))}
        </div>
      )}
      {showEndedLabel && (
        <div className="mt-auto pt-6 text-center text-sm font-medium text-[#6b584c]">発表は終了しました</div>
      )}
    </section>
  );
}

function TranscriptBlock({
  segment,
  isLatestPage,
  isNewestSegment,
}: {
  segment: DisplaySegment;
  isLatestPage: boolean;
  isNewestSegment: boolean;
}) {
  const displayedText = segment.personalizedText ?? segment.polishedText;

  return (
    <article
      className={[
        "transition-all duration-500",
        isLatestPage ? "opacity-100" : "opacity-78",
        isNewestSegment ? "translate-y-0" : "",
      ].join(" ")}
    >
      <p className="max-w-[30ch] text-[clamp(0.92rem,3.5vw,1.08rem)] font-medium leading-[1.5] tracking-[0.01em] text-[#9d978f]">
        {segment.rawText}
      </p>
      <p
        className={[
          "mt-1.5 max-w-[14ch] text-[clamp(1.72rem,7vw,2.45rem)] font-black leading-[1.04] tracking-[-0.06em] text-[#19120d]",
          isNewestSegment ? "drop-shadow-[0_10px_32px_rgba(75,46,20,0.12)]" : "",
        ].join(" ")}
      >
        {displayedText}
      </p>
      {segment.isPersonalizing && (
        <div className="mt-3 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8c6f4d]">
          <span className="h-2 w-2 rounded-full bg-[#d89f4a] animate-pulse" />
          表現を調整中
        </div>
      )}
    </article>
  );
}

function CenteredMessage({ message }: { message: string }) {
  return (
    <section className="flex h-[100svh] items-center justify-center px-6 py-8">
      <p className="text-center text-[clamp(1.65rem,7vw,2.4rem)] font-black tracking-[-0.05em] text-[#6b584c]">
        {message}
      </p>
    </section>
  );
}
