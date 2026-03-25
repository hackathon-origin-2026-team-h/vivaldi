"use client";

import { gsap } from "gsap";
import { type RefObject, useEffect, useRef, useState } from "react";

export type Reaction = "understood" | "confused" | null;
type ReactionValue = Exclude<Reaction, null>;

type ReactionButtonConfig = {
  ariaLabel: string;
  ringClassName: string;
  value: ReactionValue;
};

type UnderstandingButtonsProps = {
  /** Called when the user taps a reaction. Tapping the selected reaction again clears it. */
  onReact?: (reaction: Reaction) => void;
  className?: string;
  disabled?: boolean;
  initialReaction?: Reaction;
};

const BUTTON_BASE_CLASS =
  "relative flex items-center justify-center w-[2.8rem] h-[2.8rem] rounded-full transition-all duration-300 shadow-sm overflow-visible";

const REACTION_BUTTONS: ReactionButtonConfig[] = [
  {
    ariaLabel: "理解できた",
    ringClassName: "pointer-events-none absolute inset-[-0.28rem] rounded-full border-2 border-[#f5b15b] opacity-0",
    value: "understood",
  },
  {
    ariaLabel: "わからなかった",
    ringClassName: "pointer-events-none absolute inset-[-0.28rem] rounded-full border-2 border-[#f3c580] opacity-0",
    value: "confused",
  },
];

/**
 * A pair of circular reaction buttons — lightbulb (understood) and ? (confused).
 *
 * - Before pressing: both buttons are grey.
 * - After pressing either button: the selected button turns accent-orange.
 * - The user can still switch to the other button later.
 */
export default function UnderstandingButtons({
  className,
  disabled = false,
  initialReaction,
  onReact,
}: UnderstandingButtonsProps) {
  const [reaction, setReaction] = useState<Reaction>(initialReaction ?? null);
  const buttonRefs = {
    confused: useRef<HTMLButtonElement>(null),
    understood: useRef<HTMLButtonElement>(null),
  };
  const iconRefs = {
    confused: useRef<SVGSVGElement>(null),
    understood: useRef<SVGSVGElement>(null),
  };
  const ringRefs = {
    confused: useRef<HTMLSpanElement>(null),
    understood: useRef<HTMLSpanElement>(null),
  };

  useEffect(() => {
    if (initialReaction === undefined) {
      return;
    }

    setReaction(initialReaction);
  }, [initialReaction]);

  useEffect(() => {
    const cleanupTargets = [
      buttonRefs.understood.current,
      buttonRefs.confused.current,
      iconRefs.understood.current,
      iconRefs.confused.current,
      ringRefs.understood.current,
      ringRefs.confused.current,
    ];

    return () => {
      gsap.killTweensOf(cleanupTargets);
    };
  }, [
    buttonRefs.confused.current,
    buttonRefs.understood.current,
    iconRefs.confused.current,
    iconRefs.understood.current,
    ringRefs.confused.current,
    ringRefs.understood.current,
  ]);

  const handleClick = (value: ReactionValue) => {
    if (disabled) {
      return;
    }

    const nextReaction: Reaction = reaction === value ? null : value;

    playReactionAnimation({
      buttonNode: buttonRefs[value].current,
      iconNode: iconRefs[value].current,
      isSelected: nextReaction === value,
      ringNode: ringRefs[value].current,
      value,
    });

    setReaction(nextReaction);
    onReact?.(nextReaction);
  };

  return (
    <div className={["flex items-center justify-center gap-3.5", className ?? ""].filter(Boolean).join(" ")}>
      {REACTION_BUTTONS.map((config) => (
        <ReactionButton
          key={config.value}
          buttonRef={buttonRefs[config.value]}
          config={config}
          disabled={disabled}
          iconRef={iconRefs[config.value]}
          isSelected={reaction === config.value}
          onClick={handleClick}
          ringRef={ringRefs[config.value]}
        />
      ))}
    </div>
  );
}

function ReactionButton({
  buttonRef,
  config,
  disabled,
  iconRef,
  isSelected,
  onClick,
  ringRef,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  config: ReactionButtonConfig;
  disabled: boolean;
  iconRef: RefObject<SVGSVGElement | null>;
  isSelected: boolean;
  onClick: (value: ReactionValue) => void;
  ringRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onClick(config.value)}
      disabled={disabled}
      className={[
        BUTTON_BASE_CLASS,
        disabled ? "cursor-default" : "cursor-pointer active:scale-95 hover:shadow-md",
        isSelected ? "shadow-lg" : "",
      ].join(" ")}
      style={getReactionButtonColors(isSelected)}
      aria-label={config.ariaLabel}
      aria-pressed={isSelected}
    >
      <span ref={ringRef} aria-hidden="true" className={config.ringClassName} />
      <ReactionIcon iconRef={iconRef} value={config.value} />
    </button>
  );
}

function ReactionIcon({ iconRef, value }: { iconRef: RefObject<SVGSVGElement | null>; value: ReactionValue }) {
  if (value === "understood") {
    return (
      <svg
        ref={iconRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <title>電球</title>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
      </svg>
    );
  }

  return (
    <svg
      ref={iconRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <title>はてな</title>
      <path d="M8 8a4 4 0 0 1 8 0c0 2.5-4 3.5-4 6" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function getReactionButtonColors(isSelected: boolean) {
  return {
    backgroundColor: isSelected ? "#E98527" : "#E8E3DC",
    color: isSelected ? "#FFFFFF" : "#9C958C",
  };
}

function playReactionAnimation({
  buttonNode,
  iconNode,
  isSelected,
  ringNode,
  value,
}: {
  buttonNode: HTMLButtonElement | null;
  iconNode: SVGSVGElement | null;
  isSelected: boolean;
  ringNode: HTMLSpanElement | null;
  value: "understood" | "confused";
}) {
  if (!buttonNode || !iconNode || !ringNode) {
    return;
  }

  gsap.killTweensOf([buttonNode, iconNode, ringNode]);

  const rotation = value === "understood" ? 10 : -10;
  const glowColor = isSelected ? "rgba(233, 133, 39, 0.34)" : "rgba(156, 149, 140, 0.24)";

  gsap.set(ringNode, {
    scale: 0.72,
  });

  gsap.fromTo(
    ringNode,
    {
      autoAlpha: 0.72,
      scale: 0.72,
    },
    {
      autoAlpha: 0,
      duration: 0.42,
      ease: "power2.out",
      scale: 1.38,
    },
  );

  gsap
    .timeline()
    .to(buttonNode, {
      boxShadow: `0 0 0 0.45rem ${glowColor}`,
      duration: 0.12,
      ease: "power2.out",
      rotate: rotation,
      scale: 1.14,
      y: -2,
    })
    .to(
      buttonNode,
      {
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
        duration: 0.28,
        ease: "elastic.out(1, 0.55)",
        rotate: 0,
        scale: 1,
        y: 0,
      },
      ">",
    );

  gsap
    .timeline()
    .to(iconNode, {
      duration: 0.12,
      ease: "power2.out",
      rotate: value === "understood" ? -9 : 9,
      scale: 1.2,
    })
    .to(
      iconNode,
      {
        duration: 0.28,
        ease: "elastic.out(1, 0.55)",
        rotate: 0,
        scale: 1,
      },
      ">",
    );
}
