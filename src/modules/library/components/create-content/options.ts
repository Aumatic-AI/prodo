import type { Option } from "@/components/kit/choices";

export type Ratio = "1:1" | "4:5" | "9:16" | "16:9";

export const RATIOS: { value: Ratio; label: string; use: string; box: string }[] = [
  { value: "1:1", label: "Square", use: "Feed", box: "h-7 w-7" },
  { value: "4:5", label: "Portrait", use: "Instagram feed", box: "h-8 w-[26px]" },
  { value: "9:16", label: "Story", use: "Reels, TikTok", box: "h-9 w-5" },
  { value: "16:9", label: "Wide", use: "YouTube, X", box: "h-5 w-9" },
];

export const DURATIONS: Option<"15" | "30" | "45">[] = [
  { value: "15", label: "15 sec" },
  { value: "30", label: "30 sec" },
  { value: "45", label: "45 sec" },
];

export const AUDIO: Option<"Voiceover" | "No Voice">[] = [
  { value: "Voiceover", label: "Voice-over", description: "A voice reads the script over the scenes." },
  { value: "No Voice", label: "No voice", description: "Visuals only. Add music when you post." },
];

export const CHARACTERS: Option<"female" | "male">[] = [
  { value: "female", label: "Woman" },
  { value: "male", label: "Man" },
];

/** Sent as the language name: the script prompt reads it and the voice service maps it to a code. */
export const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Hindi", "Turkish", "Hebrew"].map((name) => ({ value: name, label: name }));

const CODES: Record<string, string> = { en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", ar: "Arabic", hi: "Hindi", tr: "Turkish", he: "Hebrew" };

/** The business language (a code like "en") as one of LANGUAGES, English if unknown. */
export function languageFor(code: string | null | undefined): string {
  return (code && CODES[code]) || "English";
}

export const OTHER_PRODUCT = "__other__";
