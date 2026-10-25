"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { OnboardingDraft } from "@/core/onboarding/schemas";
import { createOnboardingStore, type OnboardingState, type OnboardingStoreApi, type Slice } from "./onboarding-store";

const OnboardingContext = createContext<OnboardingStoreApi | null>(null);

export function OnboardingStoreProvider({ draft, children }: { draft: OnboardingDraft; children: ReactNode }) {
  const [store] = useState(() => createOnboardingStore(draft));
  return <OnboardingContext.Provider value={store}>{children}</OnboardingContext.Provider>;
}

function useStoreApi(): OnboardingStoreApi {
  const store = useContext(OnboardingContext);
  if (!store) throw new Error("Onboarding hooks must be used inside OnboardingStoreProvider");
  return store;
}

export function useOnboarding<T>(selector: (state: OnboardingState) => T): T {
  return useStore(useStoreApi(), selector);
}

/** One slice of the draft plus its actions, bound to that slice. */
export function useSlice<S extends Slice>(slice: S) {
  const value = useOnboarding((s) => s.draft[slice]);
  const actions = useOnboarding(
    useShallow((s) => ({ update: s.update, addItem: s.addItem, updateItem: s.updateItem, removeItem: s.removeItem }))
  );
  return { value, ...actions };
}

/** Error message for a path in the current step, if any. */
export function useFieldError(path: string): string | undefined {
  return useOnboarding((s) => s.errors[path]);
}

/** True when any error sits under a path, e.g. "products.2". */
export function useHasErrorUnder(prefix?: string): boolean {
  return useOnboarding((s) => !!prefix && Object.keys(s.errors).some((k) => k === prefix || k.startsWith(`${prefix}.`)));
}

export function useOnboardingApi() {
  return useStoreApi();
}
