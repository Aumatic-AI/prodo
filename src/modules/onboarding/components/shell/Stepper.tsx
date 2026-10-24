"use client";

import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, isStep, stepIndex, type StepKey } from "@/core/onboarding/steps";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { usePrefetchStep } from "../../hooks/usePrefetchStep";
import { PRODUCTS_META, SERVICES_META, STEP_META } from "../../config";
import { container, focusRing } from "@/components/kit/styles";

/** Step list. Steps up to the furthest one reached can be opened. */
export function Stepper() {
  const router = useRouter();
  const prefetch = usePrefetchStep();
  const params = useParams<{ step: string }>();
  const furthest = useOnboarding((s) => s.draft.step);
  const businessType = useOnboarding((s) => s.draft.basics.businessType);

  const current = params.step && isStep(params.step) ? params.step : furthest;
  const currentIndex = stepIndex(current);
  const reached = stepIndex(furthest);
  const progress = ((currentIndex + 1) / STEPS.length) * 100;

  const label = (step: StepKey) => {
    if (step !== "business") return STEP_META[step].nav;
    if (businessType === "service") return SERVICES_META.nav;
    if (businessType === "product") return PRODUCTS_META.nav;
    return STEP_META.business.nav;
  };

  return (
    <nav aria-label="Onboarding steps">
      <ol className={cn(container, "grid grid-cols-5 gap-2 pt-1")}>
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          const done = i < currentIndex && i <= reached;
          return (
            <li key={step}>
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={i > reached}
                onClick={() => router.push(`/onboarding/${step}`)}
                onMouseEnter={() => prefetch(step)}
                onFocus={() => prefetch(step)}
                className={cn(
                  "group flex w-full min-w-0 items-center gap-2 rounded-ob pb-3 pt-2.5 text-left text-sm disabled:cursor-not-allowed",
                  focusRing,
                  isCurrent ? "font-bold text-ob-ink" : done ? "font-medium text-ob-ink-soft" : "font-medium text-ob-muted"
                )}
              >
                <span
                  className={cn(
                    "grid size-[26px] shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors",
                    isCurrent && "border-ob-primary bg-ob-primary text-ob-on-primary",
                    done && "border-ob-success bg-ob-success text-ob-on-primary",
                    !isCurrent && !done && "border-ob-line-strong bg-ob-surface text-ob-muted"
                  )}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden truncate transition-colors group-enabled:group-hover:text-ob-primary md:inline">{label(step)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="h-[3px] bg-ob-line" aria-hidden="true">
        <div className="h-full bg-ob-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
    </nav>
  );
}
