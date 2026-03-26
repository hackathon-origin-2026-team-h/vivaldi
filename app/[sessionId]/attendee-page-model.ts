"use client";

import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

export const PERSONA_KEY = "vivaldi:userPersona";
export const PAGE_TOP_PADDING = 28;
export const PAGE_BOTTOM_PADDING = 24;
export const THINKMAN_HEAD_CLEARANCE = 190;
export const PAGE_SEGMENT_GAP = 26;
export const ENDED_LABEL_RESERVED_HEIGHT = 40;
export const PAGE_BREAK_BUFFER = 36;
export const MIN_WHEEL_DELTA = 18;
export const MIN_SWIPE_DELTA = 36;
export const QUESTION_BUBBLE_DURATION_MS = 1000;

export type SessionStatus = "BEFORE" | "DURING" | "AFTER";

export type DisplaySegment = {
  id: number;
  rawText: string;
  polishedText: string;
  personalizedText: string | null;
  clarifiedText: string | null;
  isPersonalizing: boolean;
  isFeedbackPending: boolean;
  feedbackDone: boolean;
  feedbackError: boolean;
  feedbackInference: string | null;
  isRepersonalizing: boolean;
};

export type TranscriptChunk = {
  key: string;
  segmentId: number;
  rawText: string | null;
  displayText: string;
  isClarified: boolean;
  showFeedbackButtons: boolean;
  isFeedbackPending: boolean;
  feedbackDone: boolean;
  feedbackError: boolean;
  feedbackInference: string | null;
  isRepersonalizing: boolean;
};

export type TranscriptChunkDraft = Omit<TranscriptChunk, "key">;

export type TranscriptPage = {
  key: string;
  chunks: TranscriptChunk[];
};

export type TranscriptPageDraft = {
  chunks: TranscriptChunkDraft[];
};

export function loadPersona(): UserPersona {
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

export function savePersona(userPersona: UserPersona) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(PERSONA_KEY, JSON.stringify(userPersona));
}

export async function fetchPersonalizedResult(
  text: string,
  userPersona: UserPersona,
): Promise<{
  failed: boolean;
  text: string;
}> {
  try {
    const response = await fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userPersona }),
    });

    if (!response.ok) {
      return { failed: true, text };
    }

    const body = (await response.json()) as { personalized?: string };
    return {
      failed: false,
      text: body.personalized ?? text,
    };
  } catch {
    return { failed: true, text };
  }
}

export async function fetchPersonalized(text: string, userPersona: UserPersona): Promise<string> {
  const { text: personalizedText } = await fetchPersonalizedResult(text, userPersona);
  return personalizedText;
}

export async function fetchFeedback(
  text: string,
  userPersona: UserPersona,
): Promise<{
  inference: string;
  updatedPersona: UserPersona;
} | null> {
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userPersona }),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      inference?: string;
      updatedPersona?: unknown;
    };

    return {
      inference: body.inference ?? "",
      updatedPersona: parsePersona(body.updatedPersona),
    };
  } catch {
    return null;
  }
}

export function getDisplayedSegmentText(segment: DisplaySegment) {
  return segment.clarifiedText ?? segment.personalizedText ?? segment.polishedText;
}

export function createIncomingSegment({
  id,
  polishedText,
  rawText,
}: {
  id: number;
  polishedText: string;
  rawText: string;
}): DisplaySegment {
  return {
    id,
    rawText,
    polishedText,
    personalizedText: null,
    clarifiedText: null,
    isPersonalizing: true,
    isFeedbackPending: false,
    feedbackDone: false,
    feedbackError: false,
    feedbackInference: null,
    isRepersonalizing: false,
  };
}

export function updateSegmentInList(
  segments: DisplaySegment[],
  segmentId: number,
  updater: (segment: DisplaySegment) => DisplaySegment,
) {
  return segments.map((segment) => (segment.id === segmentId ? updater(segment) : segment));
}
