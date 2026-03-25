import {
  type DisplaySegment,
  getDisplayedSegmentText,
  PAGE_SEGMENT_GAP,
  type TranscriptChunkDraft,
  type TranscriptPageDraft,
} from "./attendee-page-model";

const SPLIT_LOOKBACK_LIMIT = 12;
const SPLIT_LOOKBACK_RATIO = 0.65;
const SOFT_BREAK_CHARACTERS = new Set(["。", "、", "，", "．", "！", "？", " ", "　", "）", "」", "\n"]);

export type MeasureChunkHeight = (rawText: string | null, displayText: string, showFeedbackButtons: boolean) => number;

export function buildPages(
  segments: DisplaySegment[],
  availablePageHeight: number,
  measureChunkHeight: MeasureChunkHeight,
): TranscriptPageDraft[] {
  if (segments.length === 0) {
    return [];
  }

  if (availablePageHeight <= 0) {
    return [
      {
        chunks: segments.map((segment) => ({
          segmentId: segment.id,
          rawText: segment.rawText,
          displayText: getDisplayedSegmentText(segment),
          isClarified: segment.clarifiedText !== null,
          showFeedbackButtons: true,
        })),
      },
    ];
  }

  const pages: TranscriptPageDraft[] = [];
  let currentPageChunks: TranscriptChunkDraft[] = [];
  let currentPageHeight = 0;

  const commitCurrentPage = () => {
    if (currentPageChunks.length === 0) {
      return;
    }

    pages.push({ chunks: currentPageChunks });
    currentPageChunks = [];
    currentPageHeight = 0;
  };

  for (const segment of segments) {
    let remainingDisplayText = getDisplayedSegmentText(segment);
    let nextRawText: string | null = segment.rawText;
    let isContinuationChunk = false;

    while (remainingDisplayText.length > 0) {
      const pageGap = currentPageChunks.length > 0 ? PAGE_SEGMENT_GAP : 0;
      const remainingHeight = availablePageHeight - currentPageHeight - pageGap;
      const fullChunkHeight = measureChunkHeight(nextRawText, remainingDisplayText, true);

      if (fullChunkHeight > 0 && fullChunkHeight <= remainingHeight) {
        currentPageChunks.push({
          segmentId: segment.id,
          rawText: nextRawText,
          displayText: remainingDisplayText,
          isClarified: segment.clarifiedText !== null,
          showFeedbackButtons: true,
        });
        currentPageHeight += pageGap + fullChunkHeight;
        remainingDisplayText = "";
        nextRawText = null;
        continue;
      }

      const fittedDisplayText = findLargestDisplaySliceThatFits({
        availableHeight: remainingHeight,
        displayText: remainingDisplayText,
        measureChunkHeight,
        rawText: nextRawText,
        showFeedbackButtons: isContinuationChunk,
      });

      if (fittedDisplayText.length === 0) {
        if (currentPageChunks.length > 0) {
          commitCurrentPage();
          continue;
        }

        if (nextRawText !== null) {
          nextRawText = null;
          continue;
        }

        currentPageChunks.push({
          segmentId: segment.id,
          rawText: null,
          displayText: remainingDisplayText.slice(0, 1),
          isClarified: segment.clarifiedText !== null,
          showFeedbackButtons: isContinuationChunk,
        });
        currentPageHeight = measureChunkHeight(null, remainingDisplayText.slice(0, 1), isContinuationChunk);
        remainingDisplayText = remainingDisplayText.slice(1);
        isContinuationChunk = true;
        commitCurrentPage();
        continue;
      }

      currentPageChunks.push({
        segmentId: segment.id,
        rawText: nextRawText,
        displayText: fittedDisplayText,
        isClarified: segment.clarifiedText !== null,
        showFeedbackButtons: isContinuationChunk,
      });
      currentPageHeight += pageGap + measureChunkHeight(nextRawText, fittedDisplayText, isContinuationChunk);
      remainingDisplayText = remainingDisplayText.slice(fittedDisplayText.length);
      nextRawText = null;
      isContinuationChunk = true;
      commitCurrentPage();
    }
  }

  commitCurrentPage();
  return pages;
}

export function haveSamePagination(currentPages: TranscriptPageDraft[], nextPages: TranscriptPageDraft[]) {
  if (currentPages.length !== nextPages.length) {
    return false;
  }

  return currentPages.every((page, pageIndex) => {
    const nextPage = nextPages[pageIndex];
    if (!nextPage || page.chunks.length !== nextPage.chunks.length) {
      return false;
    }

    return page.chunks.every((chunk, chunkIndex) => {
      const nextChunk = nextPage.chunks[chunkIndex];

      return (
        chunk.segmentId === nextChunk?.segmentId &&
        chunk.rawText === nextChunk?.rawText &&
        chunk.displayText === nextChunk?.displayText &&
        chunk.isClarified === nextChunk?.isClarified &&
        chunk.showFeedbackButtons === nextChunk?.showFeedbackButtons
      );
    });
  });
}

function findLargestDisplaySliceThatFits({
  availableHeight,
  displayText,
  measureChunkHeight,
  rawText,
  showFeedbackButtons,
}: {
  availableHeight: number;
  displayText: string;
  measureChunkHeight: MeasureChunkHeight;
  rawText: string | null;
  showFeedbackButtons: boolean;
}) {
  if (availableHeight <= 0 || displayText.length === 0) {
    return "";
  }

  let low = 0;
  let high = displayText.length;
  let bestFitLength = 0;

  while (low <= high) {
    const candidateLength = Math.floor((low + high) / 2);
    const candidateText = displayText.slice(0, candidateLength);

    if (candidateText.length === 0) {
      low = candidateLength + 1;
      continue;
    }

    const candidateHeight = measureChunkHeight(rawText, candidateText, showFeedbackButtons);

    if (candidateHeight <= availableHeight) {
      bestFitLength = candidateLength;
      low = candidateLength + 1;
    } else {
      high = candidateLength - 1;
    }
  }

  if (bestFitLength === 0) {
    return "";
  }

  const minimumAcceptedIndex = Math.max(1, Math.floor(bestFitLength * SPLIT_LOOKBACK_RATIO));
  const lookbackStart = Math.max(minimumAcceptedIndex, bestFitLength - SPLIT_LOOKBACK_LIMIT);

  for (let index = bestFitLength; index > lookbackStart; index--) {
    if (SOFT_BREAK_CHARACTERS.has(displayText[index - 1] ?? "")) {
      return displayText.slice(0, index);
    }
  }

  return displayText.slice(0, bestFitLength);
}
