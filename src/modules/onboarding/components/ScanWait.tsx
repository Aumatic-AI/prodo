"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { scanRunning } from "@/core/onboarding/scan";
import { button, card } from "@/components/kit/styles";
import { useOnboarding } from "../store/OnboardingStoreProvider";

/** True while the website is still being read and the client hasn't chosen to fill this step in themselves. */
export function useScanWait() {
  const running = useOnboarding((s) => scanRunning(s.draft.scan));
  const [skipped, setSkipped] = useState(false);
  return { waiting: running && !skipped, skip: () => setSkipped(true) };
}

/** Shown in place of a step that the website scan is about to fill. */
export function ScanWait({ onSkip }: { onSkip: () => void }) {
  const website = useOnboarding((s) => s.draft.scan?.website ?? "");
  return (
    <section className={card} aria-live="polite">
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 size={28} className="animate-spin text-ob-primary" aria-hidden="true" />
        <h2 className="m-0 text-lg font-bold">Finishing reading your website…</h2>
        <p className="m-0 max-w-[440px] text-sm text-ob-muted">
          We&apos;re reading {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || "your website"}. Your details will appear here by themselves, usually within a minute or two.
        </p>
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={onSkip}>
          Fill it in myself
        </button>
      </div>
    </section>
  );
}
