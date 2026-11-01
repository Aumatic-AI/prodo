import { env } from "@/config/env";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { quoted } from "@/core/error-text";
import { replyError, request, type KnownErrors } from "@/providers/http";
import type { Result } from "@/providers/usage";

const SERVICE = "ElevenLabs";
const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

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

function headers() {
  if (!env.ELEVENLABS_API_KEY) throw notConfigured(SERVICE, "ELEVENLABS_API_KEY is empty on the server");
  return { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
}

// Its documented codes (elevenlabs.io/docs/eleven-api/resources/errors). Newer replies put the code
// in detail.code, older ones (and music) in detail.status; vendorParts reads both.
const KNOWN: KnownErrors = {
  invalid_api_key: { say: "it rejected our API key", type: "NOT_CONFIGURED", retry: false },
  missing_api_key: { say: "the API key was missing from the request", type: "NOT_CONFIGURED", retry: false },
  detected_unusual_activity: { say: "it blocked the free plan for unusual activity (a paid plan avoids this)", type: "NOT_CONFIGURED", retry: false },
  insufficient_credits: { say: "it's out of credit", type: "OUT_OF_CREDIT", retry: false },
  quota_exceeded: { say: "it's out of credit", type: "OUT_OF_CREDIT", retry: false },
  feature_not_available: { say: "the plan doesn't include this", type: "NOT_CONFIGURED", retry: false },
  subscription_required: { say: "this needs a paid plan", type: "NOT_CONFIGURED", retry: false },
  model_access_denied: { say: "the plan doesn't include this voice model", type: "NOT_CONFIGURED", retry: false },
  voice_access_denied: { say: "this account can't use that voice", type: "INVALID_INPUT", retry: false },
  insufficient_permissions: { say: "the API key isn't allowed to do this", type: "NOT_CONFIGURED", retry: false },
  voice_not_found: { say: "the voice isn't available any more; pick another voice", type: "INVALID_INPUT", retry: false },
  model_not_found: { say: "it doesn't have this voice model", type: "NOT_CONFIGURED", retry: false },
  text_too_long: { say: "the script is longer than the voice model takes in one go", type: "INVALID_INPUT", retry: false },
  max_character_limit_exceeded: { say: "the script is longer than the voice model takes in one go", type: "INVALID_INPUT", retry: false },
  empty_text: { say: "the script was empty", type: "INVALID_INPUT", retry: false },
  invalid_text: { say: "it couldn't read the script", type: "INVALID_INPUT", retry: false },
  invalid_voice_settings: { say: "it didn't accept the voice settings", type: "INVALID_INPUT", retry: false },
  invalid_output_format: { say: "the plan doesn't include this audio format", type: "NOT_CONFIGURED", retry: false },
  bad_prompt: { say: "it rejected the music description (it names an artist, a band or lyrics it can't use)", type: "CONTENT_BLOCKED", retry: false },
  bad_composition_plan: { say: "it rejected the music plan (it names an artist, a band or lyrics it can't use)", type: "CONTENT_BLOCKED", retry: false },
  rate_limit_exceeded: { say: "too many requests; it asked us to wait", type: "RATE_LIMITED", retry: true },
  concurrent_limit_exceeded: { say: "too many voice or music jobs at once for the plan", type: "RATE_LIMITED", retry: true },
  too_many_concurrent_requests: { say: "too many voice or music jobs at once for the plan", type: "RATE_LIMITED", retry: true },
  system_busy: { say: "it's overloaded right now", type: "RATE_LIMITED", retry: true },
  internal_error: { say: "it had an internal error", type: "PROVIDER_DOWN", retry: true },
  service_unavailable: { say: "it's unavailable right now", type: "PROVIDER_DOWN", retry: true },
  maintenance: { say: "it's down for maintenance", type: "PROVIDER_DOWN", retry: true },
};

async function errorFrom(res: Response): Promise<AppError> {
  const text = await res.text().catch(() => "");
  let body: any;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const err = replyError(SERVICE, res, body, text, undefined, KNOWN);
  // A rejected music description comes with a suggestion that would pass
  const suggestion = body?.detail?.data?.prompt_suggestion;
  return suggestion ? new AppError(`${err.message.replace(/\.$/, "")} It suggests${quoted(suggestion)}.`, err.type, err.retryable, err.retryAfterMs) : err;
}

export interface Speech {
  buffer: Buffer;
  durationSec: number;
  /** End time of each word, for captions */
  words: { word: string; start: number; end: number }[];
}

/** Voice-over with timestamps, so we know the real spoken length. */
export async function generateSpeech(text: string, voiceId = DEFAULT_VOICE, langCode?: string): Promise<Result<Speech>> {
  const res = await request(SERVICE, `${API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      text,
      model_id: MODELS.voice,
      ...(langCode ? { language_code: langCode } : {}),
      voice_settings: { stability: 0.75, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw await errorFrom(res);

  const data = await res.json();
  const chars: string[] = data.alignment?.characters ?? [];
  const starts: number[] = data.alignment?.character_start_times_seconds ?? [];
  const ends: number[] = data.alignment?.character_end_times_seconds ?? [];

  return {
    data: {
      buffer: Buffer.from(data.audio_base64, "base64"),
      durationSec: ends.length ? Math.max(...ends) : 0,
      words: toWords(chars, starts, ends),
    },
    usage: { provider: "elevenlabs", model: MODELS.voice, costUsd: (text.length / 1000) * PRICING.elevenlabs.voicePer1kChars },
  };
}

function toWords(chars: string[], starts: number[], ends: number[]) {
  const words: Speech["words"] = [];
  let current = "";
  let start = 0;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (current) words.push({ word: current, start, end: ends[i - 1] ?? start });
      current = "";
      return;
    }
    if (!current) start = starts[i] ?? 0;
    current += c;
  });
  if (current) words.push({ word: current, start, end: ends[chars.length - 1] ?? start });
  return words;
}

export async function generateMusic(prompt: string, lengthSec: number): Promise<Result<Buffer>> {
  const res = await request(
    SERVICE,
    `${API_BASE}/music`,
    { method: "POST", headers: headers(), body: JSON.stringify({ prompt, music_length_ms: Math.round(lengthSec * 1000) }) },
    LIMITS.downloadTimeoutMs
  );
  if (!res.ok) throw await errorFrom(res);
  return {
    data: Buffer.from(await res.arrayBuffer()),
    usage: { provider: "elevenlabs", model: MODELS.music, costUsd: (lengthSec / 60) * PRICING.elevenlabs.musicPerMinute },
  };
}

export interface Voice {
  voice_id: string;
  name: string;
  gender: string;
  age: string;
  accent: string;
  language: string;
  description: string;
  /** Style, e.g. "calm", "confident" */
  descriptive: string;
  use_case: string;
  category: string;
  featured: boolean;
  /** How many people use this voice */
  cloned_by_count: number;
  preview_url: string;
}

/** Filters the ElevenLabs voice library accepts (GET /v1/shared-voices). */
export interface VoiceFilters {
  page: number;
  page_size: number;
  search?: string;
  language?: string;
  accent?: string;
  gender?: string;
  age?: string;
  category?: "professional" | "famous" | "high_quality";
  use_cases?: string[];
  featured?: boolean;
  sort?: "created_date" | "usage_character_count_1y" | "trending" | "cloned_by_count";
}

export interface VoicePage {
  voices: Voice[];
  hasMore: boolean;
  total: number;
}

function voiceQuery(filters: VoiceFilters): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "" || value === false) continue;
    // Lists repeat the key: use_cases=a&use_cases=b
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, String(value));
  }
  return qs;
}

export async function listVoices(filters: VoiceFilters): Promise<VoicePage> {
  const res = await request(SERVICE, `${API_BASE}/shared-voices?${voiceQuery(filters)}`, { headers: headers() });
  if (!res.ok) throw await errorFrom(res);
  const data = await res.json();
  const voices: Voice[] = (data.voices ?? []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    gender: v.gender || "",
    age: v.age || "",
    accent: v.accent || "",
    language: v.language || "",
    description: v.description || "",
    descriptive: v.descriptive || "",
    use_case: v.use_case || "",
    category: v.category || "",
    featured: !!v.featured,
    cloned_by_count: v.cloned_by_count ?? 0,
    preview_url: v.preview_url || "",
  }));
  return { voices, hasMore: !!data.has_more, total: data.total_count ?? 0 };
}
