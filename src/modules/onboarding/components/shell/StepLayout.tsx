"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, nextStep, prevStep, stepIndex, type StepKey } from "@/core/onboarding/steps";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { useStepSave } from "../../hooks/useStepSave";
import { usePrefetchStep } from "../../hooks/usePrefetchStep";
import type { WhyItem } from "../../config";
import { button, container } from "@/components/kit/styles";

interface StepLayoutProps {
  step: StepKey;
  title: string;
  lead: string;
  why: WhyItem[];
  children: ReactNode;
  /** Replaces the default "Save & continue" action (used on Review) */
  primaryAction?: ReactNode;
}

/** Heading, form column, "Why we ask" column, and the sticky Back / Continue bar. */
export function StepLayout({ step, title, lead, why, children, primaryAction }: StepLayoutProps) {
  const router = useRouter();
  const save = useStepSave(step);
  const saving = useOnboarding((s) => s.saving);
  const saveError = useOnboarding((s) => s.saveError);
  const prefetch = usePrefetchStep();
  const back = prevStep(step);
  const next = nextStep(step);

  // Warm the next step's data while the client fills this one
  useEffect(() => {
    prefetch(next);
  }, [prefetch, next]);

  async function onContinue() {
    // In parallel with the save; refetches only if the cached copy went stale
    prefetch(next);
    if ((await save()) && next) router.push(`/onboarding/${next}`);
  }

  return (
    <>
      <div className={cn(container, "grid grid-cols-1 items-start gap-7 pb-32 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <main className="flex min-w-0 flex-col gap-5">
          <div className="mb-1 flex flex-col gap-1.5">
            <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ob-primary">
              Step {stepIndex(step) + 1} of {STEPS.length}
            </span>
            <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
            <p className="m-0 max-w-[640px] text-base text-ob-muted">{lead}</p>
          </div>
          {children}
        </main>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[132px]">
          {why.length > 0 && (
            <div className="rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Info size={16} className="text-ob-primary" aria-hidden="true" />
                Why we ask
              </div>
              <ul className="mt-3 list-none p-0">
                {why.map((w) => (
                  <li key={w.term} className="flex flex-col gap-0.5 border-t border-ob-line py-3">
                    <span className="text-sm font-semibold">{w.term}</span>
                    <span className="text-[13px] text-ob-muted">{w.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-ob-lg bg-ob-primary-soft px-[18px] py-4 text-[13px] text-ob-primary-ink">
            Every step saves when you press Continue, so you can leave and come back where you left off.
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ob-line bg-ob-surface/95 backdrop-blur-md">
        <div className={cn(container, "flex items-center justify-between gap-3 py-3.5")}>
          {back ? (
            <button type="button" className={button({ variant: "secondary" })} onClick={() => router.push(`/onboarding/${back}`)}>
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <span />
          )}
          {saveError && (
            <span className="min-w-0 flex-1 text-right text-sm text-ob-danger" role="alert">
              {saveError}
            </span>
          )}
          {primaryAction ?? (
            <button type="button" className={button()} disabled={saving} onClick={onContinue}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save &amp; continue
              {!saving && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
