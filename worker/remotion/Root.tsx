// Every composition the worker renders.
// - "ad": Prodo's video ads. One composition for every size: its length, width and height come
//   from the Timeline Prodo sends (calculateMetadata), so 9:16 and 4:5 use the same code.
// - "check-<size>": a short test video that proves rendering works after a deploy.

import type { CalculateMetadataFunction } from "remotion";
import { Composition } from "remotion";
import { Ad } from "./ad/Ad.tsx";
import { sampleTimeline } from "./ad/sample.ts";
import type { Timeline } from "./shared/timeline.ts";
import { FPS, SIZES, type SizeId } from "./sizes.ts";
import { Check, checkDefaults } from "./templates/Check.tsx";

const sizes = Object.entries(SIZES) as [SizeId, (typeof SIZES)[SizeId]][];

const adMetadata: CalculateMetadataFunction<Timeline> = ({ props }) => ({
  durationInFrames: Math.max(1, props.durationInFrames),
  width: props.width,
  height: props.height,
  fps: props.fps,
});

export function Root() {
  return (
    <>
      <Composition id="ad" component={Ad} defaultProps={sampleTimeline} calculateMetadata={adMetadata} durationInFrames={sampleTimeline.durationInFrames} fps={FPS} width={1080} height={1920} />
      {sizes.map(([size, { width, height }]) => (
        <Composition
          key={`check-${size}`}
          id={`check-${size}`}
          component={Check}
          defaultProps={checkDefaults}
          durationInFrames={4 * FPS}
          fps={FPS}
          width={width}
          height={height}
        />
      ))}
    </>
  );
}
