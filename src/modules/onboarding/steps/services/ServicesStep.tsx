"use client";

import { useEffect, useState } from "react";
import type { TeamPhotoDraft } from "@/core/onboarding/schemas";
import { AddButton, FromSiteBadge, NumberedList, OptionalBadge, Section } from "../../components/blocks";
import { ScanWait, useScanWait } from "../../components/ScanWait";
import { Alert } from "@/components/kit/Alert";
import { LIMITS } from "@/config/limits";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { ChoiceCards, Pills } from "@/components/kit/choices";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { SERVICES_META, SERVICE_AREA_OPTIONS, TEAM_PHOTO_KIND_OPTIONS } from "../../config";
import { newService } from "../../lib/factories";
import { ServiceCard } from "./ServiceCard";
import { CaseStudiesSection } from "./CaseStudiesSection";
import { CredentialsSection } from "./CredentialsSection";

type PhotoKind = TeamPhotoDraft["kind"];

export function ServicesStep() {
  const { value: v, update, addItem } = useSlice("services");
  const currency = useOnboarding((s) => s.draft.basics.currency);
  const { waiting, skip } = useScanWait();
  const found = v.services.filter((s) => s.found).length;
  const set = (patch: Partial<typeof v>) => update("services", patch);
  // New team photos are tagged with the kind picked here
  const [photoKind, setPhotoKind] = useState<PhotoKind>("team");

  // A service is required, so start with one empty card (unless the website read is about to fill the list)
  useEffect(() => {
    if (!waiting && !v.services.length) addItem("services", "services", newService(currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  if (waiting) {
    return (
      <StepLayout step="business" title={SERVICES_META.title} lead={SERVICES_META.lead} primaryAction={<span />}>
        <ScanWait onSkip={skip} />
      </StepLayout>
    );
  }

  return (
    <StepLayout step="business" title={SERVICES_META.title} lead={SERVICES_META.lead}>
      <Section title="Your services" path="services" badge={found ? <FromSiteBadge /> : undefined}>
        {found > 0 && (
          <Alert tone="success">
            <strong>Added your {found} main services from your website.</strong> Check their prices and details. Add any others you want to promote below.
          </Alert>
        )}
        <div className="flex flex-col gap-3">
          {v.services.map((s, i) => (
            <ServiceCard key={s.id} index={i} service={s} canRemove={v.services.length > 1} />
          ))}
        </div>
        {v.services.length < LIMITS.offeringsMax ? (
          <AddButton onClick={() => addItem("services", "services", newService(currency))}>Add service</AddButton>
        ) : (
          <p className="m-0 text-[13px] text-ob-muted">You&apos;ve added the most services ({LIMITS.offeringsMax}). Remove one to add another.</p>
        )}
      </Section>

      <Section title="Where do you serve?">
        <Field path="area">
          <ChoiceCards label="Service area" options={SERVICE_AREA_OPTIONS} value={v.area} onChange={(area) => set({ area })} />
        </Field>
        {v.area === "local" && (
          <Field label="Areas covered" htmlFor="areas" path="areas" hint="We also look up your Google Maps reviews.">
            <TextInput id="areas" value={v.areas} onValueChange={(areas) => set({ areas })} placeholder="e.g. Sliema, St Julian's, Valletta" />
          </Field>
        )}
      </Section>

      <Section title="Case studies and results" badge={<OptionalBadge />} description="Real results make the strongest ads.">
        <CaseStudiesSection />
      </Section>

      <Section title="Credentials" badge={<OptionalBadge />}>
        <CredentialsSection />
      </Section>

      <Section title="Team, office and work photos" badge={<OptionalBadge />} description="Real photos of your team, space and work. Used as reference images in ads." path="teamPhotos">
        <Field label="Next photos are of">
          <Pills label="Photo kind" options={TEAM_PHOTO_KIND_OPTIONS} value={photoKind} onChange={setPhotoKind} />
        </Field>
        <MediaUploader
          purpose="photo"
          max={12}
          value={v.teamPhotos}
          onChange={(teamPhotos) => set({ teamPhotos })}
          extend={(u) => ({ ...u, kind: photoKind })}
          tagOf={(p) => TEAM_PHOTO_KIND_OPTIONS.find((o) => o.value === p.kind)?.label}
        />
      </Section>

      <Section title="Free guide or lead magnet" badge={<OptionalBadge />} description="A free download or checklist that brings in leads. Where customers go is set in Basics.">
        <Field label="Link" htmlFor="lead" path="leadMagnetUrl" optional>
          <TextInput id="lead" type="url" inputMode="url" value={v.leadMagnetUrl} onValueChange={(leadMagnetUrl) => set({ leadMagnetUrl })} placeholder="https://" />
        </Field>
      </Section>

      <Section title="Top 5 questions and objections" badge={<OptionalBadge />} description="We turn these into objection-handling posts." path="faqs">
        <NumberedList
          label="Question"
          value={v.faqs}
          onChange={(faqs) => set({ faqs })}
          max={5}
          addLabel="Add question"
          placeholder={(i) => (i === 0 ? "e.g. How long does installation take?" : "Another common question")}
        />
      </Section>
    </StepLayout>
  );
}
