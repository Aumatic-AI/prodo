// The ad: draws one Timeline (worker/remotion/shared/timeline.ts) built by Prodo. Scenes play in a
// TransitionSeries; captions, titles, cards and stickers sit above at their frames; the soundtrack
// runs underneath. Every time and place comes from the Timeline; this file only draws.

import { loadFont } from "@remotion/fonts";
import { TransitionSeries } from "@remotion/transitions";
import { Fragment, useState } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { PRESETS, type PresetId } from "../shared/presets.ts";
import type { Layer, Timeline } from "../shared/timeline.ts";
import { EndCard, Offer, Price, Review, Stat, StepBadge, Sticker } from "./Cards.tsx";
import { Grain, LightLeak, LogoBug, ProgressBar } from "./Finish.tsx";
import { SceneView } from "./Scene.tsx";
import { Soundtrack } from "./Soundtrack.tsx";
import { Captions, Title } from "./Text.tsx";
import { presentationFor, timingFor } from "./transitions.ts";

/** Loads the brand fonts once; the render waits for them (loadFont holds it). */
function useBrandFonts(fonts: Timeline["theme"]["fonts"]) {
  useState(() => {
    for (const f of fonts) loadFont({ family: f.family, url: f.url, weight: String(f.weight) }).catch(() => undefined);
    return true;
  });
}

function LayerView({ layer, timeline }: { layer: Layer; timeline: Timeline }) {
  const preset = PRESETS[timeline.preset as PresetId] ?? PRESETS.minimal;
  switch (layer.kind) {
    case "title": {
      // A step number at the same time and zone sits just above the line
      const step = timeline.layers.find((l): l is Extract<Layer, { kind: "step" }> => l.kind === "step" && l.zone === layer.zone && Math.abs(l.startFrame - layer.startFrame) < 10);
      return <Title layer={layer} preset={preset} timeline={timeline} stepAbove={step ? <StepBadge layer={step} preset={preset} timeline={timeline} /> : undefined} />;
    }
    case "step": {
      // Drawn with its title when there is one
      const hasTitle = timeline.layers.some((l) => l.kind === "title" && l.zone === layer.zone && Math.abs(l.startFrame - layer.startFrame) < 10);
      return hasTitle ? null : (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: timeline.safe.top }}>
          <StepBadge layer={layer} preset={preset} timeline={timeline} />
        </AbsoluteFill>
      );
    }
    case "stat":
      return <Stat layer={layer} preset={preset} timeline={timeline} />;
    case "review":
      return <Review layer={layer} preset={preset} timeline={timeline} />;
    case "price":
      return <Price layer={layer} preset={preset} timeline={timeline} />;
    case "offer":
      return <Offer layer={layer} preset={preset} timeline={timeline} />;
    case "sticker":
      return <Sticker layer={layer} preset={preset} />;
    case "endCard":
      return <EndCard layer={layer} preset={preset} timeline={timeline} />;
  }
}

export function Ad(timeline: Timeline) {
  const { width, height } = useVideoConfig();
  const preset = PRESETS[timeline.preset as PresetId] ?? PRESETS.minimal;
  useBrandFonts(timeline.theme.fonts);

  return (
    <AbsoluteFill style={{ background: timeline.theme.dark.bg }}>
      <TransitionSeries>
        {timeline.scenes.map((scene, i) => {
          const t = timeline.transitions[i];
          return (
            <Fragment key={scene.id}>
              <TransitionSeries.Sequence durationInFrames={scene.durationFrames}>
                <SceneView scene={scene} />
              </TransitionSeries.Sequence>
              {t && t.kind !== "none" && t.durationFrames > 0 && <TransitionSeries.Transition presentation={presentationFor(t, width, height)} timing={timingFor(t)} />}
            </Fragment>
          );
        })}
      </TransitionSeries>

      {/* Warm light on the cuts the preset marks */}
      {timeline.transitions.map((t, i) =>
        t.lightLeak ? <LightLeak key={`leak-${i}`} at={timeline.scenes[i + 1].startFrame + Math.round(t.durationFrames / 2)} frames={t.durationFrames} /> : null
      )}

      {timeline.layers.map((layer, i) => (
        <Sequence key={`layer-${i}`} from={layer.startFrame} durationInFrames={Math.max(1, layer.durationFrames)} layout="none">
          <AbsoluteFill>
            <LayerView layer={layer} timeline={timeline} />
          </AbsoluteFill>
        </Sequence>
      ))}

      <Captions pages={timeline.captions} preset={preset} timeline={timeline} />
      <LogoBug timeline={timeline} />
      <ProgressBar timeline={timeline} />
      <Grain amount={preset.grain} />
      <Soundtrack audio={timeline.audio} />
    </AbsoluteFill>
  );
}
