"use client";

import { gsap } from "gsap";
import Image from "next/image";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import UnderstandingButtons from "@/components/UnderstandingButtons";
import styles from "./attendee-page-client.module.css";
import { QUESTION_BUBBLE_DURATION_MS, type TranscriptChunk, type TranscriptPage } from "./attendee-page-model";

type BubbleMode = "hidden" | "jump" | "question" | "thumbsup";

type AttendeeViewportProps = {
  children: ReactNode;
  measurementLayer?: ReactNode;
  onJumpToLatest?: () => void;
  onTouchEnd?: (clientY: number) => void;
  onTouchStart?: (clientY: number) => void;
  onWheelNavigate?: (deltaY: number) => void;
  questionBubbleNonce?: number;
  showJumpToLatest?: boolean;
  thumbsupBubbleNonce?: number;
  trackRef?: RefObject<HTMLDivElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
};

type TranscriptPageSectionProps = {
  onRequestClarify: (segmentId: number) => void;
  onRequestUnderstand: () => void;
  page: TranscriptPage;
  pageIndex: number;
  sectionRef?: RefObject<HTMLElement | null>;
  showEndedLabel: boolean;
};

type TranscriptFeedbackButtonsProps = {
  interactive: boolean;
  onUnderstand?: () => void;
  onUnclear?: () => void;
  selectedReaction?: "confused" | "understood";
  visible: boolean;
};

const CLAP_BURST_ITEM_CLASSES = [
  styles.clapBurstItem1,
  styles.clapBurstItem2,
  styles.clapBurstItem3,
  styles.clapBurstItem4,
  styles.clapBurstItem5,
];

export function AttendeeViewport({
  children,
  measurementLayer,
  onJumpToLatest,
  onTouchEnd,
  onTouchStart,
  onWheelNavigate,
  questionBubbleNonce = 0,
  showJumpToLatest = false,
  thumbsupBubbleNonce = 0,
  trackRef,
  viewportRef,
}: AttendeeViewportProps) {
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const bubbleTailRef = useRef<HTMLSpanElement>(null);
  const bubbleContentRef = useRef<HTMLSpanElement>(null);
  const clapRefs = useRef<Array<HTMLDivElement | null>>([]);
  const temporaryBubbleVisual = useTemporaryBubbleVisual({
    questionBubbleNonce,
    thumbsupBubbleNonce,
  });
  const bubbleMode: BubbleMode =
    temporaryBubbleVisual === "question"
      ? "question"
      : temporaryBubbleVisual === "thumbsup"
        ? "thumbsup"
        : showJumpToLatest
          ? "jump"
          : "hidden";

  useThinkmanBubbleAnimation({
    bubbleContentRef,
    bubbleMode,
    bubbleRef,
    bubbleTailRef,
  });
  useClapBurstAnimation({
    clapRefs,
    thumbsupBubbleNonce,
  });

  return (
    <main className={styles.attendeeScreen}>
      <div aria-hidden="true" className={styles.clapBurstLayer}>
        {CLAP_BURST_ITEM_CLASSES.map((itemClassName, index) => (
          <div
            key={itemClassName}
            ref={(node) => {
              clapRefs.current[index] = node;
            }}
            className={`${styles.clapBurstItem} ${itemClassName}`}
          >
            <Image
              alt=""
              className={styles.clapBurstImage}
              draggable={false}
              height={512}
              src="/images/clap.png"
              width={512}
            />
          </div>
        ))}
      </div>

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
          <span
            ref={bubbleContentRef}
            aria-hidden="true"
            className={bubbleMode === "thumbsup" ? styles.bubbleAssetWrap : styles.bubbleIcon}
          >
            {bubbleMode === "thumbsup" ? (
              <Image
                alt=""
                className={styles.bubbleThumbsup}
                draggable={false}
                height={512}
                src="/images/thumbsup.png"
                width={512}
              />
            ) : bubbleMode === "question" ? (
              "❓"
            ) : (
              "☟"
            )}
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
  onRequestUnderstand,
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
              <TranscriptBlock
                key={chunk.key}
                chunk={chunk}
                onRequestClarify={onRequestClarify}
                onRequestUnderstand={onRequestUnderstand}
              />
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
  onRequestUnderstand,
}: {
  chunk: TranscriptChunk;
  onRequestClarify: (segmentId: number) => void;
  onRequestUnderstand: () => void;
}) {
  return (
    <article className={styles.transcriptBlock}>
      {chunk.rawText !== null && <p className={styles.rawText}>{chunk.rawText}</p>}
      <p className={`${styles.displayText} ${chunk.isClarified ? styles.displayTextClarified : ""}`}>
        {chunk.displayText}
      </p>
      <TranscriptFeedbackButtons
        interactive
        onUnderstand={onRequestUnderstand}
        onUnclear={() => {
          onRequestClarify(chunk.segmentId);
        }}
        selectedReaction={chunk.isClarified ? "confused" : undefined}
        visible={chunk.showFeedbackButtons}
      />
    </article>
  );
}

function TranscriptFeedbackButtons({
  interactive,
  onUnderstand,
  onUnclear,
  selectedReaction,
  visible,
}: TranscriptFeedbackButtonsProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={styles.feedbackButtons}>
      <UnderstandingButtons
        disabled={!interactive}
        initialReaction={selectedReaction}
        onReact={(reaction) => {
          if (reaction === "understood") {
            onUnderstand?.();
          }

          if (reaction === "confused") {
            onUnclear?.();
          }
        }}
      />
    </div>
  );
}

function useTemporaryBubbleVisual({
  questionBubbleNonce,
  thumbsupBubbleNonce,
}: {
  questionBubbleNonce: number;
  thumbsupBubbleNonce: number;
}) {
  const [visual, setVisual] = useState<"question" | "thumbsup" | null>(null);
  const lastQuestionNonceRef = useRef(0);
  const lastThumbsupNonceRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const startTemporaryVisual = useCallback((nextVisual: "question" | "thumbsup") => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setVisual(nextVisual);
    timerRef.current = window.setTimeout(() => {
      setVisual(null);
      timerRef.current = null;
    }, QUESTION_BUBBLE_DURATION_MS);
  }, []);

  useEffect(() => {
    if (questionBubbleNonce === 0 || questionBubbleNonce === lastQuestionNonceRef.current) {
      return;
    }

    lastQuestionNonceRef.current = questionBubbleNonce;
    startTemporaryVisual("question");
  }, [questionBubbleNonce, startTemporaryVisual]);

  useEffect(() => {
    if (thumbsupBubbleNonce === 0 || thumbsupBubbleNonce === lastThumbsupNonceRef.current) {
      return;
    }

    lastThumbsupNonceRef.current = thumbsupBubbleNonce;
    startTemporaryVisual("thumbsup");
  }, [startTemporaryVisual, thumbsupBubbleNonce]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return visual;
}

function useThinkmanBubbleAnimation({
  bubbleContentRef,
  bubbleMode,
  bubbleRef,
  bubbleTailRef,
}: {
  bubbleContentRef: RefObject<HTMLSpanElement | null>;
  bubbleMode: BubbleMode;
  bubbleRef: RefObject<HTMLButtonElement | null>;
  bubbleTailRef: RefObject<HTMLSpanElement | null>;
}) {
  const bounceRef = useRef<gsap.core.Tween | null>(null);
  const previousBubbleModeRef = useRef<BubbleMode>("hidden");

  useEffect(() => {
    const bubbleNode = bubbleRef.current;
    const bubbleTailNode = bubbleTailRef.current;
    const bubbleContentNode = bubbleContentRef.current;

    if (!bubbleNode || !bubbleTailNode || !bubbleContentNode) {
      return;
    }

    const previousBubbleMode = previousBubbleModeRef.current;

    bounceRef.current?.kill();
    bounceRef.current = null;
    gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleContentNode]);

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
        gsap.set(bubbleContentNode, { y: 0 });
      }

      previousBubbleModeRef.current = bubbleMode;
      return;
    }

    const playJumpBounce = () => {
      gsap.set(bubbleContentNode, { autoAlpha: 1, rotate: 0, scale: 1, y: -5 });
      bounceRef.current = gsap.to(bubbleContentNode, {
        duration: 0.78,
        ease: "sine.inOut",
        repeat: -1,
        y: 7,
        yoyo: true,
      });
    };

    const playQuestionPop = () => {
      gsap.fromTo(
        bubbleContentNode,
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

    const playThumbsupPop = () => {
      gsap.fromTo(
        bubbleContentNode,
        {
          autoAlpha: 0,
          rotate: -24,
          scale: 0.28,
          y: 16,
        },
        {
          autoAlpha: 1,
          duration: 0.34,
          ease: "back.out(2.4)",
          rotate: 0,
          scale: 1,
          y: 0,
        },
      );

      bounceRef.current = gsap.to(bubbleContentNode, {
        delay: 0.12,
        duration: 0.22,
        ease: "sine.inOut",
        repeat: 1,
        rotation: 10,
        scale: 1.06,
        y: -8,
        yoyo: true,
      });
    };

    if (previousBubbleMode === "hidden") {
      gsap.set([bubbleNode, bubbleTailNode], {
        autoAlpha: 0,
        scale: 0.2,
        x: 18,
        y: 18,
        transformOrigin: "100% 100%",
      });
      gsap.set(bubbleContentNode, { autoAlpha: 1, rotate: 0, scale: 1, y: 0 });

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
      } else if (bubbleMode === "question") {
        playQuestionPop();
      } else {
        playThumbsupPop();
      }

      previousBubbleModeRef.current = bubbleMode;

      return () => {
        revealTimeline.kill();
        bounceRef.current?.kill();
        gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleContentNode]);
      };
    }

    if (bubbleMode === "jump") {
      playJumpBounce();
    } else if (bubbleMode === "question") {
      gsap.set(bubbleContentNode, { rotate: 0, y: 0 });
      playQuestionPop();
    } else {
      gsap.set(bubbleContentNode, { y: 0 });
      playThumbsupPop();
    }

    previousBubbleModeRef.current = bubbleMode;

    return () => {
      bounceRef.current?.kill();
      gsap.killTweensOf([bubbleNode, bubbleTailNode, bubbleContentNode]);
    };
  }, [bubbleContentRef, bubbleMode, bubbleRef, bubbleTailRef]);
}

function useClapBurstAnimation({
  clapRefs,
  thumbsupBubbleNonce,
}: {
  clapRefs: RefObject<Array<HTMLDivElement | null>>;
  thumbsupBubbleNonce: number;
}) {
  useEffect(() => {
    if (thumbsupBubbleNonce === 0) {
      return;
    }

    const clapNodes = clapRefs.current.filter((node): node is HTMLDivElement => node !== null);
    if (clapNodes.length === 0) {
      return;
    }

    gsap.killTweensOf(clapNodes);
    gsap.set(clapNodes, {
      autoAlpha: 0,
      rotate: (_index: number) => (Math.random() - 0.5) * 42,
      scale: 0.24,
      transformOrigin: "50% 85%",
      y: 0,
    });

    const burstTimeline = gsap.timeline();
    burstTimeline
      .to(clapNodes, {
        autoAlpha: 1,
        duration: 0.36,
        ease: "back.out(2.4)",
        rotate: (_index: number) => (Math.random() - 0.5) * 20,
        scale: 1.08,
        stagger: 0.05,
      })
      .to(
        clapNodes,
        {
          duration: 0.2,
          ease: "sine.inOut",
          repeat: 1,
          scale: 0.96,
          yoyo: true,
        },
        0.12,
      )
      .to(
        clapNodes,
        {
          autoAlpha: 0,
          duration: 0.34,
          ease: "power3.in",
          rotate: (_index: number) => (Math.random() - 0.5) * 54,
          scale: 0.52,
          stagger: 0.04,
          y: 24,
        },
        0.72,
      );

    return () => {
      burstTimeline.kill();
      gsap.killTweensOf(clapNodes);
    };
  }, [clapRefs, thumbsupBubbleNonce]);
}
