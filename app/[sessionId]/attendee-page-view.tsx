"use client";

import { gsap } from "gsap";
import Image from "next/image";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import UnderstandingButtons from "@/components/UnderstandingButtons";
import styles from "./attendee-page-client.module.css";
import { QUESTION_BUBBLE_DURATION_MS, type TranscriptChunk, type TranscriptPage } from "./attendee-page-model";
import {
  type BubbleMode,
  CONFETTI_PARTICLES,
  getConfettiStyle,
  isAssetBubbleMode,
  resolveBubbleMode,
  TEMPORARY_BUBBLE_HIDE_DURATION_MS,
  type TemporaryBubbleVisual,
  THUMBSUP_BUBBLE_IMAGE_SRC,
} from "./attendee-page-visuals";

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
  selectedReaction?: "confused" | "understood" | null;
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
  thumbsupBubbleNonce = 0,
  trackRef,
  viewportRef,
}: AttendeeViewportProps) {
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const bubbleTailRef = useRef<HTMLSpanElement>(null);
  const bubbleContentRef = useRef<HTMLSpanElement>(null);
  const confettiRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const { isClosing, visual: temporaryBubbleVisual } = useTemporaryBubbleVisual({
    questionBubbleNonce,
    thumbsupBubbleNonce,
  });
  const bubbleMode = resolveBubbleMode({
    isClosing,
    showJumpToLatest,
    temporaryBubbleVisual,
  });

  useThinkmanBubbleAnimation({
    bubbleContentRef,
    bubbleMode,
    bubbleRef,
    bubbleTailRef,
  });
  useConfettiBurstAnimation({
    confettiRefs,
    thumbsupBubbleNonce,
  });

  return (
    <main className={styles.attendeeScreen}>
      <ConfettiLayer confettiRefs={confettiRefs} />

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
            className={isAssetBubbleMode(bubbleMode) ? styles.bubbleAssetWrap : styles.bubbleIcon}
          >
            <BubbleGraphic bubbleMode={bubbleMode} />
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
        selectedReaction={getSelectedReaction(chunk)}
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

function getSelectedReaction(chunk: TranscriptChunk): "confused" | null {
  if (chunk.feedbackError) {
    return null;
  }

  if (chunk.isClarified || chunk.isFeedbackPending || chunk.feedbackDone || chunk.isRepersonalizing) {
    return "confused";
  }

  return null;
}

function ConfettiLayer({ confettiRefs }: { confettiRefs: RefObject<Array<HTMLSpanElement | null>> }) {
  return (
    <div aria-hidden="true" className={styles.confettiLayer}>
      {CONFETTI_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.color}-${particle.left}`}
          ref={(node) => {
            confettiRefs.current[index] = node;
          }}
          className={styles.confettiPiece}
          style={getConfettiStyle(particle)}
        />
      ))}
    </div>
  );
}

function BubbleGraphic({ bubbleMode }: { bubbleMode: BubbleMode }) {
  if (isAssetBubbleMode(bubbleMode)) {
    return (
      <Image
        alt=""
        className={styles.bubbleThumbsup}
        draggable={false}
        height={512}
        src={THUMBSUP_BUBBLE_IMAGE_SRC}
        width={512}
      />
    );
  }

  if (bubbleMode === "jump") {
    return "☟";
  }

  return null;
}

function useTemporaryBubbleVisual({
  questionBubbleNonce,
  thumbsupBubbleNonce,
}: {
  questionBubbleNonce: number;
  thumbsupBubbleNonce: number;
}) {
  const [visual, setVisual] = useState<TemporaryBubbleVisual>(null);
  const [isClosing, setIsClosing] = useState(false);
  const lastQuestionNonceRef = useRef(0);
  const lastThumbsupNonceRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const displayTimerRef = useRef<number | null>(null);

  const startTemporaryVisual = useCallback((nextVisual: "question" | "thumbsup") => {
    if (displayTimerRef.current !== null) {
      window.clearTimeout(displayTimerRef.current);
    }

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    setIsClosing(false);
    setVisual(nextVisual);

    displayTimerRef.current = window.setTimeout(() => {
      setVisual(null);
      setIsClosing(true);
      displayTimerRef.current = null;

      closeTimerRef.current = window.setTimeout(() => {
        setIsClosing(false);
        closeTimerRef.current = null;
      }, TEMPORARY_BUBBLE_HIDE_DURATION_MS);
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
      if (displayTimerRef.current !== null) {
        window.clearTimeout(displayTimerRef.current);
      }

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return {
    isClosing,
    visual,
  };
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

      const bubbleRevealDelay = 0.1;
      const revealTimeline = gsap.timeline();
      revealTimeline
        .to(bubbleTailNode, {
          autoAlpha: 1,
          duration: 0.22,
          ease: "back.out(2.2)",
          scale: 1,
          x: 0,
          y: 0,
        })
        .to(
          bubbleNode,
          {
            autoAlpha: 1,
            duration: 0.42,
            ease: "back.out(1.9)",
            scale: 1,
            x: 0,
            y: 0,
          },
          bubbleRevealDelay,
        )
        .add(() => {
          if (bubbleMode === "jump") {
            playJumpBounce();
          } else if (bubbleMode === "question") {
            playQuestionPop();
          } else {
            playThumbsupPop();
          }
        }, bubbleRevealDelay + 0.06);

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

function useConfettiBurstAnimation({
  confettiRefs,
  thumbsupBubbleNonce,
}: {
  confettiRefs: RefObject<Array<HTMLSpanElement | null>>;
  thumbsupBubbleNonce: number;
}) {
  useEffect(() => {
    if (thumbsupBubbleNonce === 0) {
      return;
    }

    const confettiNodes = confettiRefs.current.filter((node): node is HTMLSpanElement => node !== null);
    if (confettiNodes.length === 0) {
      return;
    }

    gsap.killTweensOf(confettiNodes);
    gsap.set(confettiNodes, {
      autoAlpha: 0,
      rotate: (_index: number) => CONFETTI_PARTICLES[_index]?.rotation ?? 0,
      scale: 0.2,
      transformOrigin: "50% 50%",
      x: 0,
      y: 0,
    });

    const burstTimeline = gsap.timeline();

    burstTimeline
      .to(
        confettiNodes,
        {
          autoAlpha: 1,
          duration: 0.09,
          ease: "power2.out",
          scale: (_index: number) => CONFETTI_PARTICLES[_index]?.scale ?? 1,
          stagger: 0.006,
        },
        0,
      )
      .to(
        confettiNodes,
        {
          duration: 0.92,
          ease: "power3.out",
          rotate: (_index: number) => (CONFETTI_PARTICLES[_index]?.rotation ?? 0) * 0.5,
          x: (_index: number) => CONFETTI_PARTICLES[_index]?.driftX ?? 0,
          y: (_index: number) => -(CONFETTI_PARTICLES[_index]?.fallY ?? 0),
          stagger: 0.007,
        },
        0,
      )
      .to(
        confettiNodes,
        {
          duration: 0.74,
          ease: "power2.in",
          rotate: (_index: number) => CONFETTI_PARTICLES[_index]?.rotation ?? 0,
          y: (_index: number) => (CONFETTI_PARTICLES[_index]?.fallY ?? 0) * 0.26,
          stagger: 0.006,
        },
        0.4,
      )
      .to(
        confettiNodes,
        {
          autoAlpha: 0,
          duration: 0.24,
          ease: "power2.out",
          stagger: 0.006,
        },
        0.86,
      );

    return () => {
      burstTimeline.kill();
      gsap.killTweensOf(confettiNodes);
    };
  }, [confettiRefs, thumbsupBubbleNonce]);
}
