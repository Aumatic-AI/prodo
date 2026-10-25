"use client";

import { AccountsList } from "@/modules/accounts/components/AccountsList";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { Alert, Section } from "../../components/blocks";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { POSTING_LABELS, STEP_META, WHY_WE_ASK } from "../../config";
import { useMissingAccounts } from "./useMissingAccounts";

export function ConnectStep() {
  const { isLoading } = useAccounts();
  const posting = useOnboarding((s) => s.draft.style.postsPerWeek);
  const missing = useMissingAccounts();

  return (
    <StepLayout step="connect" title={STEP_META.connect.title} lead={STEP_META.connect.lead} why={WHY_WE_ASK.connect}>
      <Section
        title="Social accounts"
        description="Connect the accounts you want Prodo to post to. You'll sign in on each platform's own page; we never see your password."
      >
        <AccountsList planned={posting} />
        {missing.length > 0 && !isLoading && (
          <Alert tone="warn">
            You plan posts on {missing.map((p) => POSTING_LABELS[p]).join(", ")} but haven&apos;t connected {missing.length > 1 ? "them" : "it"} yet. You can connect later;
            we just won&apos;t post there until you do.
          </Alert>
        )}
      </Section>

      <Section title="What connecting lets us do">
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-ob-ink-soft">
          <li>Schedule and publish your approved posts.</li>
          <li>Read your past posts and their results, so we learn what already works for you.</li>
          <li>Set your starting baseline. We need about 10 past posts per platform; with fewer we use typical numbers and mark them as an estimate.</li>
        </ul>
      </Section>
    </StepLayout>
  );
}
