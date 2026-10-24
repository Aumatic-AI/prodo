// Wizard steps in order. "business" shows products or services by business type.
export const STEPS = ["basics", "business", "style", "connect", "review"] as const;
export type StepKey = (typeof STEPS)[number];

export function isStep(value: string): value is StepKey {
  return (STEPS as readonly string[]).includes(value);
}

export function stepIndex(step: StepKey): number {
  return STEPS.indexOf(step);
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
