"use client";

import { defaultPersona, parsePersona, type UserPersona } from "@/lib/persona";

export const PERSONA_KEY = "vivaldi:userPersona";
export const PAGE_TOP_PADDING = 28;
export const PAGE_BOTTOM_PADDING = 24;
export const THINKMAN_HEAD_CLEARANCE = 258;
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
  isClarifying: boolean;
  isPersonalizing: boolean;
};

export type TranscriptChunk = {
  key: string;
  segmentId: number;
  rawText: string | null;
  displayText: string;
  isClarified: boolean;
  showFeedbackButtons: boolean;
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

export async function fetchPersonalized(text: string, userPersona: UserPersona): Promise<string> {
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

export async function fetchClarified(text: string, userPersona: UserPersona): Promise<string> {
  return fetchPersonalized(text, buildClarificationPersona(userPersona));
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
    isClarifying: false,
    isPersonalizing: true,
  };
}

export function updateSegmentInList(
  segments: DisplaySegment[],
  segmentId: number,
  updater: (segment: DisplaySegment) => DisplaySegment,
) {
  return segments.map((segment) => (segment.id === segmentId ? updater(segment) : segment));
}

function buildClarificationPersona(userPersona: UserPersona): UserPersona {
  return {
    ...userPersona,
    feedbackHistory: [
      ...userPersona.feedbackHistory,
      {
        inference: "この文はまだ難しいので、もっと短く、もっとやさしい日本語で言い換えてほしい",
        timestamp: Date.now(),
      },
    ],
  };
}
