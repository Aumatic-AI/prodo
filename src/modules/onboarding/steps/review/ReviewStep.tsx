"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Alert } from "../../components/blocks";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { useSubmit } from "../../hooks/useSubmit";
import { useUnsavedSteps } from "../../hooks/useUnsavedSteps";
import { useMissingAccounts } from "../connect/useMissingAccounts";
import { POSTING_LABELS, STEP_META, WHY_WE_ASK } from "../../config";
import { BasicsReview } from "./BasicsReview";
import { ProductsReview } from "./ProductsReview";
import { ServicesReview } from "./ServicesReview";
import { StyleReview } from "./StyleReview";
import { AccountsReview } from "./AccountsReview";
import { button, sectionTitle } from "@/components/kit/styles";

export function ReviewStep() {
  const isService = useOnboarding((s) => s.draft.basics.businessType === "service");
  const unsaved = useUnsavedSteps();
  const dirty = unsaved.length > 0;
  const missing = useMissingAccounts();
  const { submit, submitting, error } = useSubmit();

  const submitButton = (
    <button type="button" className={button()} disabled={submitting || dirty} onClick={submit}>
      {submitting && <Loader2 size={16} className="animate-spin" />}
      Submit and start research
      {!submitting && <ArrowRight size={16} />}
    </button>
  );

  return (
    <StepLayout step="review" title={STEP_META.review.title} lead={STEP_META.review.lead} why={WHY_WE_ASK.review} primaryAction={submitButton}>
      {dirty && (
        <Alert tone="warn">
          Unsaved changes in{" "}
          {unsaved.map((u, i) => (
            <span key={u.step}>
              {i > 0 && (i === unsaved.length - 1 ? " and " : ", ")}
              <Link href={`/onboarding/${u.step}`} className="font-bold underline">
                {u.label}
              </Link>
            </span>
          ))}
          . Open {unsaved.length > 1 ? "them" : "it"} and press Save &amp; continue before submitting.
        </Alert>
      )}
      {missing.length > 0 && (
        <Alert tone="warn">
          <strong>One thing to check:</strong> you plan posts on {missing.map((p) => POSTING_LABELS[p]).join(", ")} but haven&apos;t connected{" "}
          {missing.length > 1 ? "them" : "it"}. You can connect later; we just won&apos;t post there until you do.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <BasicsReview />
      {isService ? <ServicesReview /> : <ProductsReview />}
      <StyleReview />
      <AccountsReview />

      <section className="flex flex-col gap-2.5 rounded-ob-lg bg-ob-dark p-6 text-ob-on-dark">
        <h2 className={sectionTitle}>What happens when you submit</h2>
        <p className="m-0 text-sm text-ob-on-dark-soft">
          Our agents start reading your website, brand visuals, socials and competitors. It takes about 10 minutes. Then you&apos;ll review your Brand Bible.
        </p>
      </section>
    </StepLayout>
  );
}
