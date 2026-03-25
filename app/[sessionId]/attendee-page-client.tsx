"use client";

import { gsap } from "gsap";
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { defaultPersona, type UserPersona } from "@/lib/persona";
import {
  createIncomingSegment,
  type DisplaySegment,
  ENDED_LABEL_RESERVED_HEIGHT,
  fetchFeedback,
  fetchPersonalized,
  fetchPersonalizedResult,
  getDisplayedSegmentText,
  loadPersona,
  MIN_SWIPE_DELTA,
  MIN_WHEEL_DELTA,
  PAGE_BOTTOM_PADDING,
  PAGE_BREAK_BUFFER,
  PAGE_TOP_PADDING,
  type SessionStatus,
  savePersona,
  THINKMAN_HEAD_CLEARANCE,
  type TranscriptPage,
  type TranscriptPageDraft,
  updateSegmentInList,
} from "./attendee-page-model";
import { buildPages, haveSamePagination, type MeasureChunkHeight } from "./attendee-page-pagination";
import {
  AttendeeNotFound,
  AttendeeViewport,
  CenteredMessage,
  SegmentMeasurementLayer,
  TranscriptPageSection,
} from "./attendee-page-view";

type AttendeePageClientProps = {
  sessionId: string;
};

type SessionStreamEvent =
  | { type: "session"; status: SessionStatus }
  | { type: "segment"; id: number; polishedText: string; rawText: string };

const PAGE_RENDER_WINDOW_RADIUS = 1;
const MANUAL_NAVIGATION_LOCK_MS = 520;

export default function AttendeePageClient({ sessionId }: AttendeePageClientProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesTrackRef = useRef<HTMLDivElement>(null);
  const latestPageRef = useRef<HTMLElement>(null);
  const measureBlockRef = useRef<HTMLElement>(null);
  const measureRawRef = useRef<HTMLParagraphElement>(null);
  const measureDisplayRef = useRef<HTMLParagraphElement>(null);
  const personaRef = useRef<UserPersona>(defaultPersona);
  const touchStartYRef = useRef<number | null>(null);
  const transitionTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const isTransitioningRef = useRef(false);
  const manualNavigationLockRef = useRef(false);
  const manualNavigationUnlockTimerRef = useRef<number | null>(null);
  const previousPageCountRef = useRef(0);
  const pageSlotIdRef = useRef(0);
  const activePageIndexRef = useRef(0);

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pageOverflowCompensation, setPageOverflowCompensation] = useState(0);
  const [questionBubbleNonce, setQuestionBubbleNonce] = useState(0);
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [transcriptPages, setTranscriptPages] = useState<TranscriptPage[]>([]);
  const [understoodBubbleNonce, setUnderstoodBubbleNonce] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const renderWindow = getRenderWindow(activePageIndex, transcriptPages.length);
  const renderedPages = transcriptPages.slice(renderWindow.start, renderWindow.endExclusive);

  const personalizeSegment = useEffectEvent((segmentId: number, text: string) => {
    const currentPersona = personaRef.current;

    void fetchPersonalized(text, currentPersona).then((personalizedText) => {
      setSegments((current) =>
        updateSegmentInList(current, segmentId, (segment) => ({
          ...segment,
          personalizedText,
          isPersonalizing: false,
        })),
      );
    });
  });

  const triggerQuestionBubble = useEffectEvent(() => {
    setQuestionBubbleNonce((current) => current + 1);
  });

  const triggerUnderstoodCelebration = useEffectEvent(() => {
    setUnderstoodBubbleNonce((current) => current + 1);
  });

  const clarifySegment = useEffectEvent((segmentId: number) => {
    const targetSegment = segments.find((segment) => segment.id === segmentId);
    if (!targetSegment || targetSegment.isFeedbackPending || targetSegment.isRepersonalizing) {
      return;
    }

    triggerQuestionBubble();

    if (targetSegment.feedbackDone) {
      return;
    }

    const feedbackText = getDisplayedSegmentText(targetSegment);
    const currentPersona = personaRef.current;

    setSegments((current) =>
      updateSegmentInList(current, segmentId, (segment) => ({
        ...segment,
        isFeedbackPending: true,
        feedbackError: false,
      })),
    );

    void fetchFeedback(feedbackText, currentPersona).then((feedbackResult) => {
      if (!feedbackResult) {
        setSegments((current) =>
          updateSegmentInList(current, segmentId, (segment) => ({
            ...segment,
            isFeedbackPending: false,
            feedbackError: true,
          })),
        );
        return;
      }

      personaRef.current = feedbackResult.updatedPersona;
      savePersona(feedbackResult.updatedPersona);

      setSegments((current) =>
        updateSegmentInList(current, segmentId, (segment) => ({
          ...segment,
          isFeedbackPending: false,
          feedbackDone: true,
          feedbackError: false,
          feedbackInference: feedbackResult.inference,
          isRepersonalizing: true,
        })),
      );

      void fetchPersonalizedResult(targetSegment.polishedText, feedbackResult.updatedPersona).then(
        ({ failed, text: clarifiedText }) => {
          setSegments((current) =>
            updateSegmentInList(current, segmentId, (segment) => ({
              ...segment,
              clarifiedText: failed ? segment.clarifiedText : clarifiedText,
              isRepersonalizing: false,
            })),
          );
        },
      );
    });
  });

  const animateToPage = useEffectEvent((nextPageIndex: number, direction: "forward" | "backward" | "jump") => {
    const trackNode = pagesTrackRef.current;
    if (!trackNode || viewportHeight === 0) {
      return;
    }

    const boundedPageIndex = clampPageIndex(nextPageIndex, transcriptPages.length);
    const currentPageIndex = activePageIndexRef.current;
    const currentRenderWindow = getRenderWindow(currentPageIndex, transcriptPages.length);
    const nextRelativePageIndex = boundedPageIndex - currentRenderWindow.start;

    if (boundedPageIndex === currentPageIndex && direction !== "jump") {
      return;
    }

    transitionTimelineRef.current?.kill();
    isTransitioningRef.current = true;

    const outgoingPageBody = getPageBody(trackNode, currentPageIndex);
    const incomingPageBody = getPageBody(trackNode, boundedPageIndex);

    if (!incomingPageBody || (direction !== "backward" && !outgoingPageBody)) {
      const nextRenderWindow = getRenderWindow(boundedPageIndex, transcriptPages.length);

      syncActivePage({
        activePageIndexRef,
        pageIndex: boundedPageIndex,
        setActivePageIndex,
      });

      gsap.set(trackNode, {
        y: getTrackOffset(boundedPageIndex - nextRenderWindow.start, viewportHeight),
      });
      clearPageBodyAnimations(trackNode);
      isTransitioningRef.current = false;
      transitionTimelineRef.current = null;
      return;
    }

    clearPageBodyAnimations(trackNode);

    if (direction === "backward" && incomingPageBody) {
      gsap.set(incomingPageBody, {
        autoAlpha: 0,
        y: -42,
      });
    }

    const transitionTimeline = gsap.timeline({
      onComplete: () => {
        activePageIndexRef.current = boundedPageIndex;
        setActivePageIndex(boundedPageIndex);
        isTransitioningRef.current = false;
        transitionTimelineRef.current = null;
        clearPageBodyAnimations(trackNode);
      },
    });

    if (direction !== "backward" && outgoingPageBody) {
      transitionTimeline.to(
        outgoingPageBody,
        {
          autoAlpha: 0,
          duration: 0.24,
          ease: "power2.in",
          y: -32,
        },
        0,
      );
    }

    transitionTimeline.to(
      trackNode,
      {
        duration: 0.4,
        ease: "power3.inOut",
        y: getTrackOffset(nextRelativePageIndex, viewportHeight),
      },
      0,
    );

    if (direction === "backward" && incomingPageBody) {
      transitionTimeline.to(
        incomingPageBody,
        {
          autoAlpha: 1,
          duration: 0.34,
          ease: "power2.out",
          y: 0,
        },
        0.08,
      );
    }

    transitionTimelineRef.current = transitionTimeline;
  });

  const goToPreviousPage = useEffectEvent(() => {
    if (isTransitioningRef.current) {
      return;
    }

    const nextPageIndex = activePageIndexRef.current - 1;
    if (nextPageIndex < 0) {
      return;
    }

    animateToPage(nextPageIndex, "backward");
  });

  const goToNextPage = useEffectEvent((mode: "manual" | "jump" = "manual") => {
    if (isTransitioningRef.current) {
      return;
    }

    const nextPageIndex =
      mode === "jump"
        ? clampPageIndex(transcriptPages.length - 1, transcriptPages.length)
        : clampPageIndex(activePageIndexRef.current + 1, transcriptPages.length);

    if (nextPageIndex === activePageIndexRef.current) {
      return;
    }

    animateToPage(nextPageIndex, mode === "jump" ? "jump" : "forward");
  });

  const lockManualNavigation = useEffectEvent(() => {
    manualNavigationLockRef.current = true;

    if (manualNavigationUnlockTimerRef.current !== null) {
      window.clearTimeout(manualNavigationUnlockTimerRef.current);
    }

    manualNavigationUnlockTimerRef.current = window.setTimeout(() => {
      manualNavigationLockRef.current = false;
      manualNavigationUnlockTimerRef.current = null;
    }, MANUAL_NAVIGATION_LOCK_MS);
  });

  const handleWheelNavigation = useEffectEvent((deltaY: number) => {
    if (manualNavigationLockRef.current) {
      return;
    }

    if (Math.abs(deltaY) < MIN_WHEEL_DELTA) {
      return;
    }

    if (deltaY < 0) {
      lockManualNavigation();
      goToPreviousPage();
      return;
    }

    lockManualNavigation();
    goToNextPage("manual");
  });

  const handleTouchStart = useEffectEvent((clientY: number) => {
    touchStartYRef.current = clientY;
  });

  const handleTouchEnd = useEffectEvent((clientY: number) => {
    if (manualNavigationLockRef.current) {
      touchStartYRef.current = null;
      return;
    }

    const startY = touchStartYRef.current;
    touchStartYRef.current = null;

    if (startY === null) {
      return;
    }

    const deltaY = clientY - startY;
    if (Math.abs(deltaY) < MIN_SWIPE_DELTA) {
      return;
    }

    if (deltaY > 0) {
      lockManualNavigation();
      goToPreviousPage();
      return;
    }

    lockManualNavigation();
    goToNextPage("manual");
  });

  useEffect(() => {
    setIsMounted(true);
    personaRef.current = loadPersona();
  }, []);

  useEffect(() => {
    return () => {
      if (manualNavigationUnlockTimerRef.current !== null) {
        window.clearTimeout(manualNavigationUnlockTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!isMounted) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(viewportRef.current?.clientHeight ?? 0);
    };

    updateViewportHeight();

    const viewportNode = viewportRef.current;
    if (!viewportNode) {
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateViewportHeight);
      resizeObserver.observe(viewportNode);

      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || viewportHeight === 0) {
      return;
    }

    setPageOverflowCompensation(0);
  }, [isMounted, viewportHeight]);

  useLayoutEffect(() => {
    if (!isMounted) {
      return;
    }

    if (segments.length === 0) {
      setTranscriptPages([]);
      return;
    }

    const measureBlockNode = measureBlockRef.current;
    const measureRawNode = measureRawRef.current;
    const measureDisplayNode = measureDisplayRef.current;

    if (!measureBlockNode || !measureRawNode || !measureDisplayNode) {
      return;
    }

    const measureChunkHeight = createMeasureChunkHeight({
      measureBlockNode,
      measureDisplayNode,
      measureRawNode,
    });
    const nextPages = buildPages(
      segments,
      getAvailablePageHeight({
        pageOverflowCompensation,
        sessionStatus,
        viewportHeight,
      }),
      measureChunkHeight,
    );

    setTranscriptPages((currentPages) => {
      if (haveSamePagination(currentPages, nextPages)) {
        return currentPages;
      }

      const normalizedNextPages = normalizeTranscriptPages({
        currentPages,
        nextPages,
        nextSlotId: () => pageSlotIdRef.current++,
      });

      if (normalizedNextPages.length < currentPages.length && viewportHeight > 0) {
        return currentPages;
      }

      return normalizedNextPages;
    });
  }, [isMounted, pageOverflowCompensation, segments, sessionStatus, viewportHeight]);

  useLayoutEffect(() => {
    if (!isMounted || viewportHeight === 0 || transcriptPages.length === 0) {
      return;
    }

    const latestPageNode = latestPageRef.current;
    if (!latestPageNode) {
      return;
    }

    const minimumOverflow = sessionStatus === "AFTER" ? 1 : 2;
    const overflowAmount = Math.ceil(latestPageNode.scrollHeight - latestPageNode.clientHeight);
    if (overflowAmount <= minimumOverflow) {
      return;
    }

    setPageOverflowCompensation((current) => {
      const next = Math.max(current, overflowAmount + 12);
      return next === current ? current : next;
    });
  }, [isMounted, sessionStatus, transcriptPages, viewportHeight]);

  useLayoutEffect(() => {
    const trackNode = pagesTrackRef.current;
    if (!isMounted || viewportHeight === 0 || !trackNode) {
      return;
    }

    if (transcriptPages.length === 0) {
      previousPageCountRef.current = 0;
      activePageIndexRef.current = 0;
      setActivePageIndex(0);
      gsap.set(trackNode, { clearProps: "transform" });
      return;
    }

    const previousPageCount = previousPageCountRef.current;
    const previousLatestPageIndex = Math.max(previousPageCount - 1, 0);
    const nextPageIndex = transcriptPages.length - 1;
    const previousPageIndex = activePageIndexRef.current;

    previousPageCountRef.current = transcriptPages.length;

    if (previousPageCount === 0) {
      syncActivePage({
        activePageIndexRef,
        pageIndex: nextPageIndex,
        setActivePageIndex,
      });
      gsap.set(trackNode, {
        y: getTrackOffset(nextPageIndex - getRenderWindow(nextPageIndex, transcriptPages.length).start, viewportHeight),
      });
      return;
    }

    if (nextPageIndex <= previousPageIndex) {
      const boundedPageIndex = clampPageIndex(previousPageIndex, transcriptPages.length);
      syncActivePage({
        activePageIndexRef,
        pageIndex: boundedPageIndex,
        setActivePageIndex,
      });
      gsap.set(trackNode, {
        y: getTrackOffset(
          boundedPageIndex - getRenderWindow(boundedPageIndex, transcriptPages.length).start,
          viewportHeight,
        ),
      });
      return;
    }

    if (previousPageIndex >= previousLatestPageIndex) {
      queueMicrotask(() => {
        animateToPage(nextPageIndex, "forward");
      });
      return;
    }

    gsap.set(trackNode, {
      y: getTrackOffset(
        previousPageIndex - getRenderWindow(previousPageIndex, transcriptPages.length).start,
        viewportHeight,
      ),
    });
  }, [isMounted, transcriptPages.length, viewportHeight]);

  useLayoutEffect(() => {
    const trackNode = pagesTrackRef.current;
    if (!trackNode || viewportHeight === 0 || isTransitioningRef.current) {
      return;
    }

    gsap.set(trackNode, {
      y: getTrackOffset(activePageIndex - renderWindow.start, viewportHeight),
    });
  }, [activePageIndex, renderWindow.start, viewportHeight]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as SessionStreamEvent;

      if (data.type === "session") {
        setSessionStatus(data.status);
        return;
      }

      setSegments((current) => {
        if (current.some((segment) => segment.id === data.id)) {
          return current;
        }

        return [...current, createIncomingSegment(data)];
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
    return <AttendeeNotFound />;
  }

  return (
    <AttendeeViewport
      measurementLayer={
        <SegmentMeasurementLayer
          measureBlockRef={measureBlockRef}
          measureDisplayRef={measureDisplayRef}
          measureRawRef={measureRawRef}
        />
      }
      onJumpToLatest={() => goToNextPage("jump")}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onWheelNavigate={handleWheelNavigation}
      questionBubbleNonce={questionBubbleNonce}
      showJumpToLatest={activePageIndex < transcriptPages.length - 1}
      thumbsupBubbleNonce={understoodBubbleNonce}
      trackRef={pagesTrackRef}
      viewportRef={viewportRef}
    >
      {renderAttendeeContent({
        clarifySegment,
        latestPageIndex: transcriptPages.length - 1,
        latestPageRef,
        renderedPages,
        renderWindowStart: renderWindow.start,
        triggerUnderstoodCelebration,
        segments,
        sessionStatus,
      })}
    </AttendeeViewport>
  );
}

function renderAttendeeContent({
  clarifySegment,
  latestPageIndex,
  latestPageRef,
  renderedPages,
  renderWindowStart,
  triggerUnderstoodCelebration,
  segments,
  sessionStatus,
}: {
  clarifySegment: (segmentId: number) => void;
  latestPageIndex: number;
  latestPageRef: RefObject<HTMLElement | null>;
  renderedPages: TranscriptPage[];
  renderWindowStart: number;
  triggerUnderstoodCelebration: () => void;
  segments: DisplaySegment[];
  sessionStatus: SessionStatus | null;
}) {
  if (sessionStatus === null || sessionStatus === "BEFORE") {
    return <CenteredMessage message="発表開始までお待ちください" />;
  }

  if (sessionStatus === "DURING" && segments.length === 0) {
    return <CenteredMessage message="まもなく翻訳を開始します" />;
  }

  return renderedPages.map((page, pageIndex) => {
    const absolutePageIndex = renderWindowStart + pageIndex;

    return (
      <TranscriptPageSection
        key={page.key}
        onRequestClarify={clarifySegment}
        onRequestUnderstand={triggerUnderstoodCelebration}
        page={page}
        pageIndex={absolutePageIndex}
        sectionRef={absolutePageIndex === latestPageIndex ? latestPageRef : undefined}
        showEndedLabel={sessionStatus === "AFTER" && absolutePageIndex === latestPageIndex}
      />
    );
  });
}

function createMeasureChunkHeight({
  measureBlockNode,
  measureDisplayNode,
  measureRawNode,
}: {
  measureBlockNode: HTMLElement;
  measureDisplayNode: HTMLParagraphElement;
  measureRawNode: HTMLParagraphElement;
}): MeasureChunkHeight {
  return (rawText, displayText, showFeedbackButtons) => {
    measureRawNode.textContent = rawText ?? "";
    measureRawNode.style.display = rawText ? "" : "none";
    measureDisplayNode.textContent = displayText;
    measureBlockNode.dataset.showFeedbackButtons = showFeedbackButtons ? "true" : "false";
    return Math.ceil(measureBlockNode.getBoundingClientRect().height);
  };
}

function normalizeTranscriptPages({
  currentPages,
  nextPages,
  nextSlotId,
}: {
  currentPages: TranscriptPage[];
  nextPages: TranscriptPageDraft[];
  nextSlotId: () => number;
}) {
  return nextPages.map((page, pageIndex) => ({
    key: currentPages[pageIndex]?.key ?? `page-slot-${nextSlotId()}`,
    chunks: page.chunks.map((chunk, chunkIndex) => ({
      key: currentPages[pageIndex]?.chunks[chunkIndex]?.key ?? `chunk-${chunk.segmentId}-${chunkIndex}-${nextSlotId()}`,
      segmentId: chunk.segmentId,
      rawText: chunk.rawText,
      displayText: chunk.displayText,
      isClarified: chunk.isClarified,
      showFeedbackButtons: chunk.showFeedbackButtons,
      isFeedbackPending: chunk.isFeedbackPending,
      feedbackDone: chunk.feedbackDone,
      feedbackError: chunk.feedbackError,
      feedbackInference: chunk.feedbackInference,
      isRepersonalizing: chunk.isRepersonalizing,
    })),
  }));
}

function getAvailablePageHeight({
  pageOverflowCompensation,
  sessionStatus,
  viewportHeight,
}: {
  pageOverflowCompensation: number;
  sessionStatus: SessionStatus | null;
  viewportHeight: number;
}) {
  const reservedHeight = sessionStatus === "AFTER" ? ENDED_LABEL_RESERVED_HEIGHT : 0;

  return Math.max(
    viewportHeight -
      PAGE_TOP_PADDING -
      PAGE_BOTTOM_PADDING -
      THINKMAN_HEAD_CLEARANCE -
      reservedHeight -
      PAGE_BREAK_BUFFER -
      pageOverflowCompensation,
    0,
  );
}

function clearPageBodyAnimations(trackNode: HTMLDivElement) {
  gsap.set(trackNode.querySelectorAll<HTMLElement>("[data-page-body]"), {
    clearProps: "opacity,transform",
  });
}

function getPageBody(trackNode: HTMLDivElement, pageIndex: number) {
  return trackNode.querySelector<HTMLElement>(`[data-page-body="${pageIndex}"]`);
}

function getTrackOffset(pageIndex: number, viewportHeight: number) {
  return -pageIndex * viewportHeight;
}

function clampPageIndex(pageIndex: number, pageCount: number) {
  return Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0));
}

function getRenderWindow(pageIndex: number, pageCount: number) {
  const clampedPageIndex = clampPageIndex(pageIndex, pageCount);
  const start = Math.max(clampedPageIndex - PAGE_RENDER_WINDOW_RADIUS, 0);
  const endExclusive = Math.min(clampedPageIndex + PAGE_RENDER_WINDOW_RADIUS + 1, pageCount);

  return {
    endExclusive,
    start,
  };
}

function syncActivePage({
  activePageIndexRef,
  pageIndex,
  setActivePageIndex,
}: {
  activePageIndexRef: { current: number };
  pageIndex: number;
  setActivePageIndex: (pageIndex: number) => void;
}) {
  activePageIndexRef.current = pageIndex;
  setActivePageIndex(pageIndex);
}
