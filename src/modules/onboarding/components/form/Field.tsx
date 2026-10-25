"use client";

import { Field as BaseField, type FieldProps } from "@/components/kit/Field";
import { useFieldError } from "../../store/OnboardingStoreProvider";

/** The kit's Field, reading its error from the onboarding store by path (e.g. "products.0.name"). */
export function Field({ path, error, ...rest }: FieldProps & { path?: string }) {
  const storeError = useFieldError(path ?? "");
  return <BaseField {...rest} error={error ?? (path ? storeError : undefined)} />;
}

export { FieldError } from "@/components/kit/Field";
