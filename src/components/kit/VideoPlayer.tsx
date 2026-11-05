"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Gauge, Maximize, Minimize, MoreVertical, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { downloadFile } from "@/lib/download";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface VideoPlayerProps {
  src: string;
  /** Size of the player box (the video keeps its shape inside it) */
  className?: string;
  /** Size of the video itself when not full screen */
  videoClassName?: string;
  /** Name of the downloaded file, without the extension */
  fileName?: string;
}

const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-full text-ob-on-dark transition-colors hover:bg-ob-on-dark/15 disabled:opacity-50";

const clock = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * A video with our own controls: play and pause, a seek bar, sound and full screen below it, and more
 * (speed, download) behind the three dots. Full screen shows speed and download in the bar itself. The
 * menu is drawn inside the player, so it still shows in full screen.
 */
export function VideoPlayer({ src, className, videoClassName, fileName = "prodo-video" }: VideoPlayerProps) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState<null | "more" | "speed">(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Full screen can also end with Escape
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // A click anywhere else closes the menu
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !(e.target as HTMLElement).closest("[data-player-menu]") && setMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  useEffect(() => () => void (hideTimer.current && clearTimeout(hideTimer.current)), []);

  // The controls fade out while the video plays and the pointer rests
  function wake() {
    setActive(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), 2500);
  }

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleMute = () => {
    if (video.current) video.current.muted = !video.current.muted;
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen();
  };

  const setRate = (rate: number) => {
    if (video.current) video.current.playbackRate = rate;
    setSpeed(rate);
    setMenu(null);
  };

  async function download() {
    setMenu(null);
    setSaving(true);
    await downloadFile(src, fileName);
    setSaving(false);
  }

  const showControls = !playing || active || !!menu;
  const speedLabel = speed === 1 ? "Normal" : `${speed}×`;

  return (
    <div
      ref={box}
      className={cn("group relative overflow-hidden rounded-ob-md bg-ob-dark", full && "flex items-center justify-center rounded-none", className)}
      onPointerMove={wake}
      onPointerLeave={() => setActive(false)}
    >
      <video
        ref={video}
        src={src}
        playsInline
        preload="metadata"
        className={cn("block", full ? "h-full w-full object-contain" : videoClassName)}
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />

      {!playing && (
        <button type="button" onClick={toggle} aria-label="Play" className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ob-dark/60 text-ob-on-dark backdrop-blur-sm transition-transform hover:scale-105">
          <Play size={24} className="ml-1" fill="currentColor" />
        </button>
      )}

      <div className={cn("absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-ob-dark/85 to-transparent px-2 pb-1.5 pt-8 transition-opacity duration-200", showControls ? "opacity-100" : "pointer-events-none opacity-0")}>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 0}
          step={0.05}
          value={time}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (video.current) video.current.currentTime = t;
            setTime(t);
          }}
          className="h-1 w-full cursor-pointer accent-ob-primary"
        />
        <div className="flex min-w-0 items-center gap-0.5">
          <button type="button" className={iconButton} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          {/* Small players keep sound in the three-dot menu, so the bar fits */}
          {full && (
            <button type="button" className={iconButton} onClick={toggleMute} aria-label={muted ? "Sound on" : "Sound off"}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
          <span className="shrink-0 whitespace-nowrap px-1 text-[11px] font-semibold tabular-nums text-ob-on-dark">
            {clock(time)} / {clock(duration)}
          </span>

          <div className="relative ml-auto flex shrink-0 items-center gap-0.5" data-player-menu>
            {full ? (
              <>
                <button type="button" className={cn(iconButton, "w-auto gap-1.5 px-3 text-xs font-bold")} onClick={() => setMenu(menu === "speed" ? null : "speed")} aria-label="Playback speed">
                  <Gauge size={16} /> {speedLabel}
                </button>
                <button type="button" className={iconButton} onClick={download} disabled={saving} aria-label="Download">
                  <Download size={18} />
                </button>
              </>
            ) : (
              <button type="button" className={iconButton} onClick={() => setMenu(menu ? null : "more")} aria-label="More options">
                <MoreVertical size={18} />
              </button>
            )}
            <button type="button" className={iconButton} onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            {menu && (
              <div className="absolute bottom-11 right-0 z-10 min-w-44 rounded-ob-md border border-ob-on-dark/10 bg-ob-dark/95 p-1 text-sm text-ob-on-dark shadow-ob-md backdrop-blur-md">
                {menu === "more" ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left hover:bg-ob-on-dark/10"
                      onClick={() => {
                        toggleMute();
                        setMenu(null);
                      }}
                    >
                      {muted ? <Volume2 size={16} /> : <VolumeX size={16} />} {muted ? "Sound on" : "Sound off"}
                    </button>
                    <button type="button" className="flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left hover:bg-ob-on-dark/10" onClick={() => setMenu("speed")}>
                      <Gauge size={16} /> Playback speed <span className="ml-auto text-xs text-ob-on-dark/70">{speedLabel}</span>
                    </button>
                    <button type="button" className="flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left hover:bg-ob-on-dark/10" onClick={download} disabled={saving}>
                      <Download size={16} /> {saving ? "Downloading…" : "Download"}
                    </button>
                  </>
                ) : (
                  SPEEDS.map((s) => (
                    <button key={s} type="button" className="flex w-full items-center gap-2.5 rounded-ob px-3 py-1.5 text-left hover:bg-ob-on-dark/10" onClick={() => setRate(s)}>
                      <span className="w-4">{s === speed && <Check size={15} />}</span>
                      {s === 1 ? "Normal" : `${s}×`}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
