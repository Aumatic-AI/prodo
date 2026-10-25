"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/SessionStoreProvider";
import { BibleReview } from "@/modules/brand/components/bible/BibleReview";
import { container } from "@/components/kit/styles";

/** Last onboarding screen: review and approve the Brand Bible, then the app opens. */
export function BibleStep() {
  const router = useRouter();
  const updateBusiness = useSession((s) => s.updateBusiness);

  function onApproved() {
    updateBusiness({ onboardingStatus: "done" });
    router.replace("/week");
    router.refresh();
  }

  return (
    <main className={cn(container, "flex max-w-[1040px] flex-col gap-5 pb-16 pt-8")}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ob-primary">Last step</span>
        <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-tight">Review your Brand Bible</h1>
        <p className="m-0 max-w-[680px] text-base text-ob-muted">
          This is how Prodo will talk about your brand. Click the small quote icons to see where each statement comes from. Edit anything, confirm what we
          found on your website, then approve.
        </p>
      </div>
      <BibleReview onApproved={onApproved} />
    </main>
  );
}
