import {
  ENDED_LABEL_RESERVED_HEIGHT,
  PAGE_BOTTOM_PADDING,
  PAGE_BREAK_BUFFER,
  PAGE_TOP_PADDING,
  type SessionStatus,
  THINKMAN_HEAD_CLEARANCE,
  type TranscriptPage,
  type TranscriptPageDraft,
} from "./attendee-page-model";
import type { MeasureChunkHeight } from "./attendee-page-pagination";

export const PAGE_RENDER_WINDOW_RADIUS = 1;
export const MANUAL_NAVIGATION_LOCK_MS = 520;
const MOBILE_VIEWPORT_BREAKPOINT = 640;
const DESKTOP_VIEWPORT_BREAKPOINT = 1024;
const MOBILE_THINKMAN_HEAD_CLEARANCE = 152;
const DESKTOP_THINKMAN_HEAD_CLEARANCE = 126;

export function createMeasureChunkHeight({
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

export function normalizeTranscriptPages({
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

export function getAvailablePageHeight({
  pageOverflowCompensation,
  sessionStatus,
  viewportWidth,
  viewportHeight,
}: {
  pageOverflowCompensation: number;
  sessionStatus: SessionStatus | null;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const reservedHeight = sessionStatus === "AFTER" ? ENDED_LABEL_RESERVED_HEIGHT : 0;
  const thinkmanHeadClearance =
    viewportWidth > 0 && viewportWidth < MOBILE_VIEWPORT_BREAKPOINT
      ? MOBILE_THINKMAN_HEAD_CLEARANCE
      : viewportWidth >= DESKTOP_VIEWPORT_BREAKPOINT
        ? DESKTOP_THINKMAN_HEAD_CLEARANCE
        : THINKMAN_HEAD_CLEARANCE;

  return Math.max(
    viewportHeight -
      PAGE_TOP_PADDING -
      PAGE_BOTTOM_PADDING -
      thinkmanHeadClearance -
      reservedHeight -
      PAGE_BREAK_BUFFER -
      pageOverflowCompensation,
    0,
  );
}

export function getTrackOffset(pageIndex: number, viewportHeight: number) {
  return -pageIndex * viewportHeight;
}

export function clampPageIndex(pageIndex: number, pageCount: number) {
  return Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0));
}

export function getRenderWindow(pageIndex: number, pageCount: number) {
  const clampedPageIndex = clampPageIndex(pageIndex, pageCount);
  const start = Math.max(clampedPageIndex - PAGE_RENDER_WINDOW_RADIUS, 0);
  const endExclusive = Math.min(clampedPageIndex + PAGE_RENDER_WINDOW_RADIUS + 1, pageCount);

  return {
    endExclusive,
    start,
  };
}

export function syncActivePage({
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
