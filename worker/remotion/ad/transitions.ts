// The Timeline's transition kinds → Remotion presentations (plain CSS ones: they render fast on a
// server without a graphics card).

import { linearTiming, springTiming, type TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Easing } from "remotion";
import type { Transition } from "../shared/timeline.ts";

export function presentationFor(t: Transition, width: number, height: number): TransitionPresentation<any> {
  switch (t.kind) {
    case "slide":
      return slide({ direction: t.direction });
    case "wipe":
      return wipe({ direction: t.direction });
    case "flip":
      return flip({ direction: t.direction, perspective: 1600 });
    case "clockWipe":
      return clockWipe({ width, height });
    case "iris":
      return iris({ width, height });
    case "zoom":
      // A punchy push with a short white flash on the cut
      return pushCut({ outgoingScale: 1.12, incomingStartScale: 1.18, incomingEndScale: 1, flashColor: "#ffffff", flashOpacity: 0.55, flashFrames: 2 });
    case "fade":
    default:
      return fade({ shouldFadeOutExitingScene: true });
  }
}

/** Springy for moves, even for fades, so motion feels physical but fades stay calm. */
export function timingFor(t: Transition) {
  return t.kind === "fade" || t.kind === "iris" || t.kind === "clockWipe"
    ? linearTiming({ durationInFrames: t.durationFrames, easing: Easing.inOut(Easing.cubic) })
    : springTiming({ durationInFrames: t.durationFrames, config: { damping: 200 } });
}
