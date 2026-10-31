// The sound: the voice-over per scene, music that ducks under speech (made voice or a talking clip)
// and fades in and out, and the sound effects on their events. Levels come from the Timeline.

import { Audio } from "@remotion/media";
import { interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Soundtrack as Track } from "../shared/timeline.ts";

/** Frames to ease the music down before speech and back up after it */
const RAMP = 8;

function Music({ music }: { music: NonNullable<Track["music"]> }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // 1 while speech plays (with soft ramps either side), 0 otherwise
  const duck = Math.max(
    0,
    ...music.speech.map((s) => interpolate(frame, [s.from - RAMP, s.from, s.to, s.to + RAMP], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  );
  const level = music.volume + (music.duckedVolume - music.volume) * duck;
  const fade = interpolate(frame, [0, music.fadeInFrames, durationInFrames - music.fadeOutFrames, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={music.url} volume={level * fade} loop />;
}

export function Soundtrack({ audio }: { audio: Track }) {
  return (
    <>
      {audio.music && <Music music={audio.music} />}
      {audio.voice.map((v, i) => (
        <Sequence key={`voice-${i}`} from={v.startFrame} layout="none">
          <Audio src={v.url} volume={v.volume} />
        </Sequence>
      ))}
      {audio.sfx.map((s, i) => (
        <Sequence key={`sfx-${i}`} from={s.startFrame} layout="none">
          <Audio src={s.url} volume={s.volume} />
        </Sequence>
      ))}
    </>
  );
}
