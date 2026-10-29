"use client";

import { Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { NUMBERED_STEPS, isStep, stepIndex, type StepKey } from "@/core/onboarding/steps";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { usePrefetchStep } from "../../hooks/usePrefetchStep";
import { PRODUCTS_META, SERVICES_META, STEP_META } from "../../config";
import { focusRing } from "@/components/kit/styles";

/** The step on screen and the furthest one reached. */
function useSteps() {
  const params = useParams<{ step: string }>();
  const furthest = useOnboarding((s) => s.draft.step);
  const current = params.step && isStep(params.step) ? params.step : furthest;
  return { current, currentIndex: stepIndex(current), reached: stepIndex(furthest) };
}

/**
 * The numbered steps in the header, joined by lines that fill in as steps are done. Steps up to
 * the furthest one reached can be opened. Labels hide on narrow screens (the current one stays
 * on medium screens).
 */
export function Stepper() {
  const router = useRouter();
  const prefetch = usePrefetchStep();
  const businessType = useOnboarding((s) => s.draft.basics.businessType);
  const { current, currentIndex, reached } = useSteps();

  const label = (step: StepKey) => {
    if (step !== "business") return STEP_META[step].nav;
    if (businessType === "service") return SERVICES_META.nav;
    if (businessType === "product") return PRODUCTS_META.nav;
    return STEP_META.business.nav;
  };

  return (
    <nav aria-label="Onboarding steps" className="min-w-0">
      <ol className="m-0 flex list-none items-center p-0">
        {NUMBERED_STEPS.map((step, n) => {
          const i = stepIndex(step);
          const isCurrent = step === current;
          const done = i < currentIndex && i <= reached;
          const open = i <= reached;
          return (
            <Fragment key={step}>
              {n > 0 && (
                <li aria-hidden="true" className="mx-0.5 h-0.5 w-3 shrink rounded-full bg-ob-line sm:mx-1 sm:w-6 lg:w-5 xl:w-7">
                  <span className={cn("block h-full rounded-full bg-ob-success transition-[width] duration-300", i <= currentIndex ? "w-full" : "w-0")} />
                </li>
              )}
              <li className="min-w-0">
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${n + 1}: ${label(step)}${done ? ", done" : ""}`}
                  title={label(step)}
                  disabled={!open}
                  onClick={() => router.push(`/onboarding/${step}`)}
                  onMouseEnter={() => prefetch(step)}
                  onFocus={() => prefetch(step)}
                  className={cn(
                    "group flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 text-[13.5px] transition-colors disabled:cursor-not-allowed",
                    focusRing,
                    isCurrent ? "bg-ob-primary-soft pr-3 font-bold text-ob-ink" : "pr-1 font-medium enabled:hover:bg-ob-sunken xl:pr-2.5",
                    done ? "text-ob-ink-soft" : !isCurrent && "text-ob-muted"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors",
                      isCurrent && "border-ob-primary bg-ob-primary text-ob-on-primary",
                      done && "border-ob-success bg-ob-success text-ob-on-primary",
                      !isCurrent && !done && "border-ob-line-strong bg-ob-surface text-ob-muted"
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : n + 1}
                  </span>
                  <span
                    className={cn(
                      "truncate transition-colors group-enabled:group-hover:text-ob-primary",
                      isCurrent ? "hidden sm:inline" : "hidden xl:inline"
                    )}
                  >
                    {label(step)}
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/** Thin progress line under the header. */
export function StepTrack() {
  const { current } = useSteps();
  const progress = ((NUMBERED_STEPS.indexOf(current) + 1) / NUMBERED_STEPS.length) * 100;
  return (
    <div className="h-0.5 bg-ob-line" aria-hidden="true">
      <div className="h-full bg-ob-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
    </div>
  );
}
