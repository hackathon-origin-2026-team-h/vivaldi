import type { CSSProperties } from "react";

export type BubbleMode = "hidden" | "jump" | "question" | "thumbsup";
export type TemporaryBubbleVisual = "question" | "thumbsup" | null;

export type ConfettiParticle = {
  color: string;
  driftX: number;
  fallY: number;
  height: string;
  left: string;
  rotation: number;
  scale: number;
  width: string;
};

export const TEMPORARY_BUBBLE_HIDE_DURATION_MS = 220;
export const THUMBSUP_BUBBLE_IMAGE_SRC = "/images/thumbsup.png";

const CONFETTI_COLORS = ["#fffdf7", "#fff4df", "#ffe7c2", "#ffd39b", "#ffbf74", "#f7a84b", "#ea8b2f", "#d86f18"];
const CONFETTI_PARTICLE_COUNT = 56;

export const CONFETTI_PARTICLES: ConfettiParticle[] = Array.from(
  { length: CONFETTI_PARTICLE_COUNT },
  (_item, index) => {
    const progress = index / Math.max(CONFETTI_PARTICLE_COUNT - 1, 1);
    const wave = Math.sin(index * 1.37);
    const widthRem = 0.34 + (index % 5) * 0.11;
    const heightRem = 0.56 + ((index * 3) % 6) * 0.16;

    return {
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? "#ff7e63",
      driftX: -168 + (index % 14) * 24 + wave * 20,
      fallY: 172 + (index % 8) * 18 + Math.abs(wave) * 18,
      height: `${heightRem.toFixed(2)}rem`,
      left: `${-4 + progress * 108 + ((index % 4) - 1.5) * 1.35}%`,
      rotation: -300 + ((index * 43) % 600),
      scale: 0.72 + ((index * 11) % 6) * 0.08,
      width: `${widthRem.toFixed(2)}rem`,
    };
  },
);

export function getConfettiStyle(particle: ConfettiParticle): CSSProperties {
  return {
    "--confetti-color": particle.color,
    "--confetti-height": particle.height,
    "--confetti-left": particle.left,
    "--confetti-width": particle.width,
  } as CSSProperties;
}

export function isAssetBubbleMode(mode: BubbleMode) {
  return mode === "thumbsup" || mode === "question";
}

export function resolveBubbleMode({
  isClosing,
  showJumpToLatest,
  temporaryBubbleVisual,
}: {
  isClosing: boolean;
  showJumpToLatest: boolean;
  temporaryBubbleVisual: TemporaryBubbleVisual;
}): BubbleMode {
  if (temporaryBubbleVisual === "question") {
    return "question";
  }

  if (temporaryBubbleVisual === "thumbsup") {
    return "thumbsup";
  }

  if (isClosing) {
    return "hidden";
  }

  return showJumpToLatest ? "jump" : "hidden";
}
