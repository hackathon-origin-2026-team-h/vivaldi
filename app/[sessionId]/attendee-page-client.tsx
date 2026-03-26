"use client";

import { gsap } from "gsap";
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { defaultPersona, type UserPersona } from "@/lib/persona";
import {
  clampPageIndex,
  createMeasureChunkHeight,
  getAvailablePageHeight,
  getRenderWindow,
  getTrackOffset,
  MANUAL_NAVIGATION_LOCK_MS,
  normalizeTranscriptPages,
  syncActivePage,
} from "./attendee-page-layout";
import {
  createIncomingSegment,
  type DisplaySegment,
  fetchFeedback,
  fetchPersonalized,
  fetchPersonalizedResult,
  getDisplayedSegmentText,
  loadPersona,
  MIN_SWIPE_DELTA,
  MIN_WHEEL_DELTA,
  type SessionStatus,
  savePersona,
  type TranscriptPage,
  updateSegmentInList,
} from "./attendee-page-model";
import { buildPages, haveSamePagination } from "./attendee-page-pagination";
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

export default function AttendeePageClient({ sessionId }: AttendeePageClientProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesTrackRef = useRef<HTMLDivElement>(null);
  const latestPageRef = useRef<HTMLElement>(null);
  const measureBlockRef = useRef<HTMLElement>(null);
  const measureRawRef = useRef<HTMLParagraphElement>(null);
  const measureDisplayRef = useRef<HTMLParagraphElement>(null);
  const personaRef = useRef<UserPersona>(defaultPersona);
  const seenSegmentIdsRef = useRef(new Set<number>());
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
  const [viewportWidth, setViewportWidth] = useState(0);
  const renderWindow = getRenderWindow(activePageIndex, transcriptPages.length);
  const renderedPages = transcriptPages.slice(renderWindow.start, renderWindow.endExclusive);

  const updateSegment = useEffectEvent((segmentId: number, updater: (segment: DisplaySegment) => DisplaySegment) => {
    setSegments((current) => updateSegmentInList(current, segmentId, updater));
  });

  const personalizeSegment = useEffectEvent((segmentId: number, text: string) => {
    const currentPersona = personaRef.current;

    void fetchPersonalized(text, currentPersona).then((personalizedText) => {
      updateSegment(segmentId, (segment) => ({
        ...segment,
        personalizedText,
        isPersonalizing: false,
      }));
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

    updateSegment(segmentId, (segment) => ({
      ...segment,
      isFeedbackPending: true,
      feedbackError: false,
    }));

    void fetchFeedback(feedbackText, currentPersona).then((feedbackResult) => {
      if (!feedbackResult) {
        updateSegment(segmentId, (segment) => ({
          ...segment,
          isFeedbackPending: false,
          feedbackError: true,
        }));
        return;
      }

      personaRef.current = feedbackResult.updatedPersona;
      savePersona(feedbackResult.updatedPersona);

      updateSegment(segmentId, (segment) => ({
        ...segment,
        isFeedbackPending: false,
        feedbackDone: true,
        feedbackError: false,
        feedbackInference: feedbackResult.inference,
        isRepersonalizing: true,
      }));

      void fetchPersonalizedResult(targetSegment.polishedText, feedbackResult.updatedPersona).then(
        ({ failed, text: clarifiedText }) => {
          updateSegment(segmentId, (segment) => ({
            ...segment,
            clarifiedText: failed ? segment.clarifiedText : clarifiedText,
            isRepersonalizing: false,
          }));
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

    const updateViewportSize = () => {
      setViewportHeight(viewportRef.current?.clientHeight ?? 0);
      setViewportWidth(viewportRef.current?.clientWidth ?? 0);
    };

    updateViewportSize();

    const viewportNode = viewportRef.current;
    if (!viewportNode) {
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateViewportSize);
      resizeObserver.observe(viewportNode);

      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
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
        viewportWidth,
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
  }, [isMounted, pageOverflowCompensation, segments, sessionStatus, viewportHeight, viewportWidth]);

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

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;

      eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data as string) as SessionStreamEvent;

        if (data.type === "session") {
          setSessionStatus(data.status);
          return;
        }

        if (seenSegmentIdsRef.current.has(data.id)) {
          return;
        }
        seenSegmentIdsRef.current.add(data.id);

        setSegments((current) => {
          if (current.some((segment) => segment.id === data.id)) {
            return current;
          }
          return [...current, createIncomingSegment(data)];
        });

        personalizeSegment(data.id, data.polishedText);
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (stopped) return;

        void fetch(`/api/sessions/${sessionId}`)
          .then((response) => {
            if (response.status === 404) {
              setNotFound(true);
              return;
            }
            reconnectTimer = setTimeout(connect, 2000);
          })
          .catch(() => {
            reconnectTimer = setTimeout(connect, 2000);
          });
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      eventSource?.close();
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

function clearPageBodyAnimations(trackNode: HTMLDivElement) {
  gsap.set(trackNode.querySelectorAll<HTMLElement>("[data-page-body]"), {
    clearProps: "opacity,transform",
  });
}

function getPageBody(trackNode: HTMLDivElement, pageIndex: number) {
  return trackNode.querySelector<HTMLElement>(`[data-page-body="${pageIndex}"]`);
}
