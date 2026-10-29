// Every template, in every size. A new video style is one component in ./templates plus one entry here.

import { Composition } from "remotion";
import { FPS, SIZES, type SizeId } from "./sizes.ts";
import { Check, checkDefaults } from "./templates/Check.tsx";

const sizes = Object.entries(SIZES) as [SizeId, (typeof SIZES)[SizeId]][];

export function Root() {
  return (
    <>
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
