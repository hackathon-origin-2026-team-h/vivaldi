"use client";

import { useEffect, useState } from "react";

type Reaction = "understood" | "confused" | null;

type UnderstandingButtonsProps = {
  /** Called when the user taps a reaction. "confused" can later transition into "understood". */
  onReact?: (reaction: "understood" | "confused") => void;
  className?: string;
  disabled?: boolean;
  initialReaction?: Reaction;
};

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

  useEffect(() => {
    if (initialReaction === undefined) {
      return;
    }

    setReaction(initialReaction);
  }, [initialReaction]);

  const handleClick = (value: "understood" | "confused") => {
    if (disabled) {
      return;
    }

    if (reaction === value) {
      return;
    }

    setReaction(value);
    onReact?.(value);
  };

  const canTapUnderstood = !disabled && reaction !== "understood";
  const canTapConfused = !disabled && reaction !== "confused";

  const baseClass =
    "flex items-center justify-center w-[2.8rem] h-[2.8rem] rounded-full transition-all duration-300 shadow-sm";

  return (
    <div className={["flex items-center justify-center gap-3.5", className ?? ""].filter(Boolean).join(" ")}>
      {/* ── 理解できた (lightbulb) ── */}
      <button
        type="button"
        onClick={() => handleClick("understood")}
        disabled={!canTapUnderstood}
        className={[
          baseClass,
          canTapUnderstood ? "cursor-pointer active:scale-95 hover:shadow-md" : "cursor-default",
          reaction === "understood" ? "shadow-lg" : "",
        ].join(" ")}
        style={{
          backgroundColor: reaction === "understood" ? "#E98527" : "#E8E3DC",
          color: reaction === "understood" ? "#FFFFFF" : "#9C958C",
        }}
        aria-label="理解できた"
      >
        {/* Lightbulb icon */}
        <svg
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
      </button>

      {/* ── わからなかった (bare question mark) ── */}
      <button
        type="button"
        onClick={() => handleClick("confused")}
        disabled={!canTapConfused}
        className={[
          baseClass,
          canTapConfused ? "cursor-pointer active:scale-95 hover:shadow-md" : "cursor-default",
          reaction === "confused" ? "shadow-lg" : "",
        ].join(" ")}
        style={{
          backgroundColor: reaction === "confused" ? "#E98527" : "#E8E3DC",
          color: reaction === "confused" ? "#FFFFFF" : "#9C958C",
        }}
        aria-label="わからなかった"
      >
        {/* Bare question mark — no surrounding circle */}
        <svg
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
      </button>
    </div>
  );
}
