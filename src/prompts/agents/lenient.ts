import { z } from "zod";

// Forgiving building blocks for AI replies: a model that writes a bit too much, sends an item in a
// slightly different shape, or leaves out an optional field shouldn't throw the whole answer away.

/** Text cut to `max` characters (never rejected for being long). */
export const clip = (max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, max));

/** Optional text: missing, empty or the wrong type becomes `fallback`. */
export const clipOr = (max: number, fallback = "") => clip(max).catch(fallback);

/** A 0–10 score; anything unreadable counts as the middle. */
export const score10 = z.coerce.number().min(0).max(10).catch(5);

/** A list where items that don't parse are skipped; strings and {text}/{fix} objects both count as text. */
export const textList = (maxItems: number, maxChars: number, minChars = 1) =>
  z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((values) =>
      (values ?? [])
        .map((v) => (typeof v === "string" ? v : v && typeof v === "object" ? String((v as any).text ?? (v as any).fix ?? (v as any).issue ?? "") : ""))
        .map((v) => v.trim().slice(0, maxChars))
        .filter((v) => v.length >= minChars)
        .slice(0, maxItems)
    );

/** A list of objects where items that don't parse are skipped. */
export const objectList = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((values) =>
      (values ?? [])
        .flatMap((value) => {
          const parsed = item.safeParse(value);
          return parsed.success ? [parsed.data as z.output<T>] : [];
        })
        .slice(0, maxItems)
    );
