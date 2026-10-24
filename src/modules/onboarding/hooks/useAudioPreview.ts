"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One audio preview at a time. Starting a new one stops the last. */
export function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    (id: string, url: string) => {
      const wasPlaying = playingId === id;
      stop();
      if (wasPlaying || !url) return;
      const audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(id);
    },
    [playingId, stop]
  );

  useEffect(() => stop, [stop]);

  return { playingId, toggle, stop };
}
