import { z } from "zod";
import { clip } from "./lenient";
import { HOOK_TYPES, LEVERS } from "@/core/creative/brief";

// Planner: our code already chose each slot's day, platforms, format, content style, goal, pillar
// and whether it's an experiment (from the client's onboarding choices and learnings). The model picks what each slot is about and writes the reason the client sees.
// Labels (S1, O2, F1, P1) map back to ids in code; unknown labels are dropped.

const slotChoice = z.object({
  slot: z.string(),
  offering: z.string().nullish().transform((v) => v || null),
  offer: z.string().nullish().transform((v) => v || null),
  persona: z.string().nullish().transform((v) => v || null),
  angle: clip(200).pipe(z.string().min(3)),
  objective: clip(200).pipe(z.string().min(3)),
  hookType: z.enum(HOOK_TYPES).catch("question"),
  levers: z
    .array(z.string())
    .nullish()
    .transform((v) => (v ?? []).filter((l): l is (typeof LEVERS)[number] => (LEVERS as readonly string[]).includes(l)).slice(0, 3)),
  rationale: clip(600).pipe(z.string().min(10)),
});
export type SlotChoice = z.infer<typeof slotChoice>;

export const plannerSchema = z.object({
  theme: clip(120).pipe(z.string().min(3)),
  rationale: clip(1000).pipe(z.string().min(10)),
  slots: z
    .array(z.unknown())
    .transform((values) =>
      values.flatMap((v) => {
        const parsed = slotChoice.safeParse(v);
        return parsed.success ? [parsed.data] : [];
      })
    ),
});
export type PlannerReply = z.infer<typeof plannerSchema>;

export const PLANNER_SYSTEM = `You are the content planner for a business. You plan one week of social posts.

Our code already fixed each slot's day, time, platforms, format, content style, goal, content pillar, funnel stage and whether it is an experiment. These follow the business owner's own choices, so keep to them. For every slot, decide:
- offering: the label (O1, O2…) of the product or service it promotes, or null for a pure brand/value post. Hero offerings get more slots. Don't promote the same offering in two slots in a row.
- offer: the label (F1…) of a live offer, only when the slot date is inside the offer's dates and the offer fits the offering (or is store-wide). Otherwise null. Urgency only comes from real offers.
- persona: the label (P1…) of the customer it speaks to. Spread personas across the week.
- angle: the specific idea of the post in one short line (e.g. "the 3 mistakes people make before buying a sofa"). It must fit the slot's style (a tips slot gets tips, a before-and-after slot a transformation, a showcase slot one product's details). Every angle must be different, and different from recent angles listed.
- objective: what the post should make the viewer do or feel, in plain words, serving the slot's goal.
- hookType: one of ${HOOK_TYPES.join(", ")}.
- levers: up to 3 of ${LEVERS.join(", ")}. Social proof, authority, scarcity and urgency only when a stored fact backs them (proof, credentials, a live offer).
- rationale: one or two plain sentences to the business owner on why this post, this week. Mention the learning or calendar date behind it when there is one.

Experiment slots try something the brand hasn't tested much yet (a new angle, hook type or lever). Other slots lean on what learnings show works.
Fit the funnel stage: tofu = reach new people, mofu = build trust and consideration, bofu = drive the action (buy, book, enquire).
Use calendar dates that fall in the week when they matter to this business.

Also give the week a short theme and a 2–3 sentence rationale for the plan as a whole.
Write in the business's language. Never invent products, prices, offers or facts.

Return JSON: { "theme": string, "rationale": string, "slots": [{ "slot": "S1", "offering": "O1" | null, "offer": "F1" | null, "persona": "P1" | null, "angle": string, "objective": string, "hookType": string, "levers": string[], "rationale": string }] }`;
