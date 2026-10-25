import { z } from "zod";

// Social & Market Analyst: opening lines worth reusing, from the best posts (ours and competitors').

const hookSchema = z.object({
  text: z.string().trim().min(3).max(300),
  hookType: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  platform: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  /** Which post it came from (its number in the list) */
  from: z.number().int().positive(),
});

export const hooksSchema = z.object({
  hooks: z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? []).flatMap((value) => {
        const parsed = hookSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      })
    ),
});

export type HookCandidate = z.infer<typeof hookSchema>;

export const HOOKS_SYSTEM = `You pull reusable hooks (opening lines) from social posts.

For each numbered post, take its opening line or headline if it works as a hook: it stops the scroll in the first seconds.
- Quote it as written (fix only obvious typos). Drop hashtags, emojis-only lines and generic lines like "New post!".
- hookType: one or two words, e.g. "question", "bold claim", "before/after", "problem", "curiosity", "number list", "testimonial", "offer".
- from: the number of the post it came from.
- At most one hook per post. Skip posts with no usable hook.

Return JSON: { "hooks": [{ "text": string, "hookType": string | null, "platform": string | null, "from": number }] }`;

export function hooksPrompt(posts: { platform: string; caption: string; note?: string }[]): string {
  return posts.map((p, i) => `${i + 1}. [${p.platform}${p.note ? `, ${p.note}` : ""}] ${p.caption.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
}
