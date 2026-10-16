"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Play, Square, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

interface Voice {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  language: string;
  description: string;
  preview_url: string;
}

interface VoiceExplorerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVoice: (voiceId: string, voiceName: string) => void;
  selectedVoiceId: string;
}

const GENDER_OPTIONS = [
  { value: "", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "All" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Hindi", label: "Hindi" },
  { value: "Turkish", label: "Turkish" },
  { value: "Hebrew", label: "Hebrew" },
  { value: "Arabic", label: "Arabic" },
];

const PAGE_SIZE = 12;

export function VoiceExplorerModal({ open, onOpenChange, onSelectVoice, selectedVoiceId }: VoiceExplorerModalProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchVoices = useCallback(async (p: number, s: string, g: string, l: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (s) params.set("search", s);
      if (g) params.set("gender", g);
      if (l) params.set("language", l);
      const data = await apiFetch<{ voices: Voice[]; hasMore: boolean }>(`/api/elevenlabs/voices?${params}`);
      setVoices(data.voices);
      setHasMore(data.hasMore);
    } catch {
      setVoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchVoices(page, search, gender, language);
  }, [open, page, gender, language, fetchVoices]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      fetchVoices(0, search, gender, language);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  function togglePlay(voice: Voice) {
    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) audioRef.current?.pause(); onOpenChange(v); }}
      title="Choose a Voice"
      description="Browse and preview voices from ElevenLabs."
      className="max-w-[720px]"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="voice-search"
            placeholder="Search voices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Dropdown options={GENDER_OPTIONS} value={gender} onChange={(v) => { setGender(v); setPage(0); }} placeholder="Gender" />
          <Dropdown options={LANGUAGE_OPTIONS} value={language} onChange={(v) => { setLanguage(v); setPage(0); }} placeholder="Language" />
        </div>

        {/* Voice grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-default">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : voices.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No voices found. Try different filters.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
            {voices.map((voice) => {
              const isSelected = voice.voice_id === selectedVoiceId;
              const isPlaying = playingId === voice.voice_id;
              return (
                <div
                  key={voice.voice_id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    isSelected ? "border-primary" : "border-default hover:border-strong"
                  )}
                  style={isSelected ? { backgroundColor: "var(--color-primary-subtle)" } : undefined}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-text">{voice.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {voice.gender && (
                        <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-surface-sunken text-muted">
                          {voice.gender}
                        </span>
                      )}
                    </div>
                  </div>
                  {voice.accent && <p className="text-xs text-secondary mb-1">{voice.accent} · {voice.language}</p>}
                  {voice.description && <p className="text-xs text-muted line-clamp-2 mb-2">{voice.description}</p>}
                  <div className="flex items-center gap-2">
                    {voice.preview_url && (
                      <button
                        onClick={() => togglePlay(voice)}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {isPlaying ? "Stop" : "Preview"}
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant={isSelected ? "primary" : "outline"}
                      onClick={() => { onSelectVoice(voice.voice_id, voice.name); onOpenChange(false); }}
                      className="ml-auto"
                    >
                      {isSelected ? <><Check className="w-3 h-3" /> Selected</> : "Use Voice"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-xs text-muted">Page {page + 1}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
