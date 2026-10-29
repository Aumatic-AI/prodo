// Wizard steps in order. "website" is the start screen (not numbered); "business" shows products
// or services by business type.
export const STEPS = ["website", "content", "basics", "business", "connect", "review"] as const;
export type StepKey = (typeof STEPS)[number];

/** The numbered steps shown in the stepper ("Step 2 of 5"). */
export const NUMBERED_STEPS: readonly StepKey[] = STEPS.filter((s) => s !== "website");

export function isStep(value: string): value is StepKey {
  return (STEPS as readonly string[]).includes(value);
}

export function stepIndex(step: StepKey): number {
  return STEPS.indexOf(step);
}

/** 1-based position among the numbered steps (0 for the start screen). */
export function stepNumber(step: StepKey): number {
  return NUMBERED_STEPS.indexOf(step) + 1;
}

export function nextStep(step: StepKey): StepKey | null {
  return STEPS[stepIndex(step) + 1] ?? null;
}

export function prevStep(step: StepKey): StepKey | null {
  return STEPS[stepIndex(step) - 1] ?? null;
}

/** The later of two steps. */
export function furthest(a: StepKey, b: StepKey): StepKey {
  return stepIndex(a) >= stepIndex(b) ? a : b;
}
