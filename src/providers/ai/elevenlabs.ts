import { env } from "@/config/env";

const API_BASE = "https://api.elevenlabs.io/v1";

const LANGUAGE_CODE_MAP: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  arabic: "ar",
  hindi: "hi",
  turkish: "tr",
  hebrew: "he",
};

export function languageCode(language?: string | null): string | undefined {
  if (!language) return undefined;
  return LANGUAGE_CODE_MAP[language.toLowerCase().trim()];
}

export interface SpeechResult {
  buffer: Buffer;
  durationSec: number;
}

/**
 * Uses the with-timestamps endpoint (not the plain TTS endpoint) so the
 * character alignment data tells us exactly how long this clip's narration
 * is — the caller needs that to size its video clip to the real spoken
 * length instead of guessing a flat duration per scene.
 */
export async function generateSpeech(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM",
  langCode?: string
): Promise<SpeechResult> {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set");

  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_flash_v2_5",
      ...(langCode ? { language_code: langCode } : {}),
      voice_settings: { stability: 0.75, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.detail?.message || parsed?.detail?.status || body;
    } catch {}
    throw new Error(`ElevenLabs API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const buffer = Buffer.from(data.audio_base64, "base64");
  const endTimes: number[] = data.alignment?.character_end_times_seconds || [];
  const durationSec = endTimes.length > 0 ? Math.max(...endTimes) : 0;
  return { buffer, durationSec };
}
