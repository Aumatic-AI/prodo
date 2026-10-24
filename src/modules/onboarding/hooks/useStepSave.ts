"use client";

import { useCallback } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { STEP_SCHEMAS, toFieldErrors, type OnboardingDraft } from "@/core/onboarding/schemas";
import type { StepKey } from "@/core/onboarding/steps";
import type { StepSlice } from "@/core/onboarding/save";
import type { Slice } from "../store/onboarding-store";
import { useOnboardingApi } from "../store/OnboardingStoreProvider";
import { useSession } from "@/stores/SessionStoreProvider";

/** Drops empty rows from string lists (e.g. an unused FAQ line) before saving. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => !(typeof v === "string" && !v.trim())).map(clean) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)])) as T;
  }
  return value;
}

function scrollToFirstError() {
  requestAnimationFrame(() => {
    document.querySelector('[data-invalid="true"], main [role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/** The draft slice a step edits on screen. */
export function sliceFor(step: StepKey, draft: OnboardingDraft): Slice | null {
  if (step === "basics" || step === "style") return step;
  if (step === "business") return draft.basics.businessType === "service" ? "services" : "products";
  return null;
}

/** Validates, saves and merges one step. Resolves true when saved. */
export function useStepSave(step: StepKey) {
  const store = useOnboardingApi();
  const updateBusiness = useSession((s) => s.updateBusiness);

  return useCallback(async (): Promise<boolean> => {
    const { draft, setErrors, setSaving, applySaved, update } = store.getState();
    const slice = sliceFor(step, draft);
    let body: unknown = {};

    if (slice) {
      const value = clean(draft[slice]);
      update(slice, value);
      const result = STEP_SCHEMAS[slice].safeParse(value);
      if (!result.success) {
        setErrors(toFieldErrors(result.error));
        scrollToFirstError();
        return false;
      }
      body = value;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ slice: StepSlice; draft: OnboardingDraft }>(`/api/onboarding/${step}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      applySaved(res.slice, res.draft);
      if (res.slice === "basics") updateBusiness({ name: res.draft.basics.name, logoKey: res.draft.basics.logoKey });
      setSaving(false);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields);
        scrollToFirstError();
      }
      setSaving(false, err instanceof Error ? err.message : "Couldn't save. Try again.");
      return false;
    }
  }, [store, step, updateBusiness]);
}
