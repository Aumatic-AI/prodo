"use client";

import { useEffect, useState } from "react";
import type { TeamPhotoDraft } from "@/core/onboarding/schemas";
import { AddButton, NumberedList, OptionalBadge, Section } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { ChoiceCards, Pills } from "@/components/kit/choices";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { SERVICES_META, SERVICE_AREA_OPTIONS, TEAM_PHOTO_KIND_OPTIONS, WHY_WE_ASK, currencyFor } from "../../config";
import { newService } from "../../lib/factories";
import { ServiceCard } from "./ServiceCard";
import { CaseStudiesSection } from "./CaseStudiesSection";
import { CredentialsSection } from "./CredentialsSection";
import { row } from "@/components/kit/styles";

type PhotoKind = TeamPhotoDraft["kind"];

export function ServicesStep() {
  const { value: v, update, addItem } = useSlice("services");
  const countries = useOnboarding((s) => s.draft.basics.countries);
  const currency = currencyFor(countries);
  const set = (patch: Partial<typeof v>) => update("services", patch);
  // New team photos are tagged with the kind picked here
  const [photoKind, setPhotoKind] = useState<PhotoKind>("team");

  useEffect(() => {
    if (!v.services.length) addItem("services", "services", newService(currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepLayout step="business" title={SERVICES_META.title} lead={SERVICES_META.lead} why={WHY_WE_ASK.services}>
      <Section title="Your services" path="services">
        <div className="flex flex-col gap-3">
          {v.services.map((s, i) => (
            <ServiceCard key={s.id} index={i} service={s} canRemove={v.services.length > 1} />
          ))}
        </div>
        <AddButton onClick={() => addItem("services", "services", newService(currency))}>Add service</AddButton>
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

      <Section title="How should people contact you?" description="Every call to action links here.">
        <div className={row}>
          <Field label="Booking link" htmlFor="booking" path="bookingUrl" optional>
            <TextInput id="booking" type="url" inputMode="url" value={v.bookingUrl} onValueChange={(bookingUrl) => set({ bookingUrl })} placeholder="https://" />
          </Field>
          <Field label="WhatsApp number" htmlFor="whatsapp" path="whatsapp" optional>
            <TextInput id="whatsapp" type="tel" inputMode="tel" value={v.whatsapp} onValueChange={(whatsapp) => set({ whatsapp })} placeholder="+356 9912 3456" />
          </Field>
        </div>
        <Field label="Free guide or lead magnet" htmlFor="lead" path="leadMagnetUrl" optional>
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
