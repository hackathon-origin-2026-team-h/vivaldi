"use client";

import { gsap } from "gsap";
import Image from "next/image";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import styles from "./attendee-page-client.module.css";
import { QUESTION_BUBBLE_DURATION_MS, type TranscriptChunk, type TranscriptPage } from "./attendee-page-model";

type BubbleMode = "hidden" | "jump" | "question";

type AttendeeViewportProps = {
  children: ReactNode;
  measurementLayer?: ReactNode;
  onJumpToLatest?: () => void;
  onTouchEnd?: (clientY: number) => void;
  onTouchStart?: (clientY: number) => void;
  onWheelNavigate?: (deltaY: number) => void;
  questionBubbleNonce?: number;
  showJumpToLatest?: boolean;
  trackRef?: RefObject<HTMLDivElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
};

type TranscriptPageSectionProps = {
  onRequestClarify: (segmentId: number) => void;
  page: TranscriptPage;
  pageIndex: number;
  sectionRef?: RefObject<HTMLElement | null>;
  showEndedLabel: boolean;
};

type TranscriptFeedbackButtonsProps = {
  interactive: boolean;
  onUnclear?: () => void;
  visible: boolean;
};

export function AttendeeViewport({
  children,
  measurementLayer,
  onJumpToLatest,
  onTouchEnd,
  onTouchStart,
  onWheelNavigate,
  questionBubbleNonce = 0,
  showJumpToLatest = false,
  trackRef,
  viewportRef,
}: AttendeeViewportProps) {
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const bubbleTailRef = useRef<HTMLSpanElement>(null);
  const bubbleIconRef = useRef<HTMLSpanElement>(null);
  const questionBubbleActive = useQuestionBubbleState(questionBubbleNonce);
  const bubbleMode: BubbleMode = questionBubbleActive ? "question" : showJumpToLatest ? "jump" : "hidden";

  useThinkmanBubbleAnimation({
    bubbleIconRef,
    bubbleMode,
    bubbleRef,
    bubbleTailRef,
  });

  return (
    <main className={styles.attendeeScreen}>
      <div className={styles.decorationRail}>
        <div className={styles.thinkmanWrap}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.thinkmanImage}
            draggable={false}
            height={4096}
            priority
            src="/images/thinkman.PNG"
            width={4096}
          />
        </div>

        <span ref={bubbleTailRef} aria-hidden="true" className={styles.bubbleTail} />

        <button
          ref={bubbleRef}
          className={styles.bubbleButton}
          disabled={!showJumpToLatest}
          onClick={onJumpToLatest}
          tabIndex={showJumpToLatest ? 0 : -1}
          type="button"
        >
          <span ref={bubbleIconRef} aria-hidden="true" className={styles.bubbleIcon}>
            {bubbleMode === "question" ? "❓" : "☟"}
          </span>
          <span className={styles.srOnly}>{showJumpToLatest ? "最新の文章へ戻る" : "Thinkmanが考えています"}</span>
        </button>
      </div>

      <div className={styles.viewportShell}>
        <div
          ref={viewportRef}
          className={styles.viewportStage}
          onTouchEnd={(event) => {
            onTouchEnd?.(event.changedTouches[0]?.clientY ?? 0);
          }}
          onTouchStart={(event) => {
            onTouchStart?.(event.touches[0]?.clientY ?? 0);
          }}
          onWheel={(event) => {
            onWheelNavigate?.(event.deltaY);
          }}
        >
          {measurementLayer}

          <div ref={trackRef} className={styles.pagesTrack}>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export function AttendeeNotFound() {
  return (
    <main className={styles.notFoundScreen}>
      <div className={styles.notFoundCard}>
        <p className={styles.notFoundTitle}>セッションが見つかりません</p>
        <p className={styles.notFoundText}>URLが正しいか、発表者がセッションを開始しているか確認してください。</p>
      </div>
    </main>
  );
}

export function SegmentMeasurementLayer({
  measureBlockRef,
  measureDisplayRef,
  measureRawRef,
}: {
  measureBlockRef: RefObject<HTMLElement | null>;
  measureDisplayRef: RefObject<HTMLParagraphElement | null>;
  measureRawRef: RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <div aria-hidden="true" className={styles.measurementLayer}>
      <div className={styles.pageFrame}>
        <div className={styles.paper}>
          <article ref={measureBlockRef} className={styles.measurementBlock} data-show-feedback-buttons="true">
            <p ref={measureRawRef} className={styles.rawText} />
            <p ref={measureDisplayRef} className={styles.displayText} />
            <TranscriptFeedbackButtons interactive={false} visible />
          </article>
        </div>
      </div>
    </div>
  );
}

export function TranscriptPageSection({
  onRequestClarify,
  page,
  pageIndex,
  sectionRef,
  showEndedLabel,
}: TranscriptPageSectionProps) {
  return (
    <section ref={sectionRef} className={styles.pageFrame}>
      <div className={styles.paper}>
        <div className={styles.pageBody} data-page-body={pageIndex}>
          <div className={styles.chunkList}>
            {page.chunks.map((chunk) => (
              <TranscriptBlock key={chunk.key} chunk={chunk} onRequestClarify={onRequestClarify} />
            ))}
          </div>
        </div>

        {showEndedLabel && <div className={styles.endedLabel}>発表は終了しました</div>}
      </div>
    </section>
  );
}

export function CenteredMessage({ message }: { message: string }) {
  return (
    <section className={styles.centeredMessage}>
      <p className={styles.centeredMessageText}>{message}</p>
    </section>
  );
}

function TranscriptBlock({
  chunk,
  onRequestClarify,
}: {
  chunk: TranscriptChunk;
  onRequestClarify: (segmentId: number) => void;
}) {
  return (
    <article className={styles.transcriptBlock}>
      {chunk.rawText !== null && <p className={styles.rawText}>{chunk.rawText}</p>}
      <p className={`${styles.displayText} ${chunk.isClarified ? styles.displayTextClarified : ""}`}>
        {chunk.displayText}
      </p>
      <TranscriptFeedbackButtons
        interactive
        onUnclear={() => {
          onRequestClarify(chunk.segmentId);
        }}
        visible={chunk.showFeedbackButtons}
      />
    </article>
  );
}

function TranscriptFeedbackButtons({ interactive, onUnclear, visible }: TranscriptFeedbackButtonsProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={styles.feedbackButtons}>
      <button
        aria-label="この翻訳文はわかった"
        className={`${styles.feedbackButton} ${styles.feedbackButtonUnderstand}`}
        data-feedback-kind="understood"
        disabled={!interactive}
        tabIndex={interactive ? 0 : -1}
        type="button"
      >
        <span aria-hidden="true" className={styles.feedbackButtonSymbol}>
          !
        </span>
        <span className={styles.srOnly}>わかる</span>
      </button>

      <button
        aria-label="この翻訳文はまだわからない"
        className={`${styles.feedbackButton} ${styles.feedbackButtonUnsure}`}
        data-feedback-kind="unclear"
        disabled={!interactive}
        onClick={onUnclear}
        tabIndex={interactive ? 0 : -1}
        type="button"
      >
        <span aria-hidden="true" className={styles.feedbackButtonSymbol}>
          ?
        </span>
        <span className={styles.srOnly}>わからない</span>
      </button>
    </div>
  );
}

function useQuestionBubbleState(questionBubbleNonce: number) {
  const [questionBubbleActive, setQuestionBubbleActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (questionBubbleNonce === 0) {
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setQuestionBubbleActive(true);
    timerRef.current = window.setTimeout(() => {
      setQuestionBubbleActive(false);
      timerRef.current = null;
    }, QUESTION_BUBBLE_DURATION_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [questionBubbleNonce]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return questionBubbleActive;
}

function useThinkmanBubbleAnimation({
  bubbleIconRef,
  bubbleMode,
  bubbleRef,
  bubbleTailRef,
}: {
  bubbleIconRef: RefObject<HTMLSpanElement | null>;
  bubbleMode: BubbleMode;
  bubbleRef: RefObject<HTMLButtonElement | null>;
  bubbleTailRef: RefObject<HTMLSpanElement | null>;
}) {
  const bounceRef = useRef<gsap.core.Tween | null>(null);
  const previousBubbleModeRef = useRef<BubbleMode>("hidden");

  useEffect(() => {
    const bubbleNode = bubbleRef.current;
    const bubbleTailNode = bubbleTailRef.current;
    const bubbleIconNode = bubbleIconRef.current;

    if (!bubbleNode || !bubbleTailNode || !bubbleIconNode) {
      return;
    }

    const previousBubbleMode = previousBubbleModeRef.current;

    bounceRef.current?.kill();
    bounceRef.current = null;
    gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleIconNode]);

    if (bubbleMode === "hidden") {
      if (previousBubbleMode !== "hidden") {
        const hideTimeline = gsap.timeline();
        hideTimeline
          .to(bubbleNode, {
            autoAlpha: 0,
            duration: 0.18,
            ease: "power2.in",
            scale: 0.78,
            x: 14,
            y: 12,
          })
          .to(
            bubbleTailNode,
            {
              autoAlpha: 0,
              duration: 0.16,
              ease: "power2.in",
              scale: 0.78,
              x: 12,
              y: 10,
            },
            0,
          );
        gsap.set(bubbleIconNode, { y: 0 });
      }

      previousBubbleModeRef.current = bubbleMode;
      return;
    }

    const playJumpBounce = () => {
      gsap.set(bubbleIconNode, { autoAlpha: 1, scale: 1, y: -5 });
      bounceRef.current = gsap.to(bubbleIconNode, {
        duration: 0.78,
        ease: "sine.inOut",
        repeat: -1,
        y: 7,
        yoyo: true,
      });
    };

    const playQuestionPop = () => {
      gsap.fromTo(
        bubbleIconNode,
        {
          autoAlpha: 0.45,
          scale: 0.62,
        },
        {
          autoAlpha: 1,
          duration: 0.22,
          ease: "back.out(1.8)",
          scale: 1,
        },
      );
    };

    if (previousBubbleMode === "hidden") {
      gsap.set([bubbleNode, bubbleTailNode], {
        autoAlpha: 0,
        scale: 0.2,
        x: 18,
        y: 18,
        transformOrigin: "100% 100%",
      });
      gsap.set(bubbleIconNode, { autoAlpha: 1, scale: 1, y: 0 });

      const revealTimeline = gsap.timeline();
      revealTimeline
        .to(bubbleNode, {
          autoAlpha: 1,
          duration: 0.42,
          ease: "back.out(1.9)",
          scale: 1,
          x: 0,
          y: 0,
        })
        .to(
          bubbleTailNode,
          {
            autoAlpha: 1,
            duration: 0.26,
            ease: "back.out(2.2)",
            scale: 1,
            x: 0,
            y: 0,
          },
          0.08,
        );

      if (bubbleMode === "jump") {
        playJumpBounce();
      } else {
        playQuestionPop();
      }

      previousBubbleModeRef.current = bubbleMode;

      return () => {
        revealTimeline.kill();
        bounceRef.current?.kill();
        gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleIconNode]);
      };
    }

    if (bubbleMode === "jump") {
      playJumpBounce();
    } else {
      gsap.set(bubbleIconNode, { y: 0 });
      playQuestionPop();
    }

    previousBubbleModeRef.current = bubbleMode;

    return () => {
      bounceRef.current?.kill();
      gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleIconNode]);
    };
  }, [bubbleIconRef, bubbleMode, bubbleRef, bubbleTailRef]);
}
