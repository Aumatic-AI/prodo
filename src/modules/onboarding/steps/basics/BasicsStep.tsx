"use client";

import { useEffect, useState } from "react";
import { Section } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { MultiSelect } from "@/components/kit/MultiSelect";
import { ChoiceCards } from "@/components/kit/choices";
import { LogoUploader } from "@/components/kit/LogoUploader";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { BUSINESS_TYPE_OPTIONS, GOAL_OPTIONS, LANGUAGE_OPTIONS, STEP_META, WHY_WE_ASK, timezoneOptions } from "../../config";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { LIMITS } from "@/config/limits";
import { SocialLinks } from "./SocialLinks";
import { row } from "@/components/kit/styles";

export function BasicsStep() {
  const { value: b, update } = useSlice("basics");
  const set = (patch: Partial<typeof b>) => update("basics", patch);
  const errors = useOnboarding((s) => s.errors);

  // Timezones come from the browser, so build the list after mount
  const [zones, setZones] = useState(() => (b.timezone ? [{ value: b.timezone, label: b.timezone }] : []));
  useEffect(() => {
    setZones(timezoneOptions());
    if (!b.timezone) set({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepLayout step="basics" title={STEP_META.basics.title} lead={STEP_META.basics.lead} why={WHY_WE_ASK.basics}>
      <Section title="Your business">
        <Field label="Business name" htmlFor="name" path="name">
          <TextInput id="name" value={b.name} onValueChange={(name) => set({ name })} placeholder="e.g. your shop or company name" autoComplete="organization" />
        </Field>
        <Field label="Logo" path="logoKey">
          <LogoUploader value={b.logoKey} onChange={(logoKey) => set({ logoKey })} />
        </Field>
        <Field
          label="Describe your business in 2–3 lines"
          htmlFor="description"
          path="description"
          hint={`We cross-check this against your website. ${b.description.length} / ${LIMITS.descriptionMaxChars}`}
        >
          <TextArea
            id="description"
            value={b.description}
            onValueChange={(description) => set({ description })}
            maxLength={LIMITS.descriptionMaxChars}
            placeholder="What you sell, who it's for, and what makes you different."
          />
        </Field>
      </Section>

      <Section title="Where we can find you">
        <Field label="Website" htmlFor="website" path="website" hint="We read up to 30 key pages: products, services, about, pricing, FAQ, reviews.">
          <TextInput id="website" type="url" inputMode="url" value={b.website} onValueChange={(website) => set({ website })} placeholder="https://" />
        </Field>
        <SocialLinks value={b.socials} onChange={(socials) => set({ socials })} errorFor={(platform) => errors[`socials.${platform}`]} />
      </Section>

      <Section title="What do you sell?" description="This decides the next step and which ad formats fit you best.">
        <Field path="businessType">
          <ChoiceCards label="What do you sell?" options={BUSINESS_TYPE_OPTIONS} value={b.businessType} onChange={(businessType) => set({ businessType })} />
        </Field>
      </Section>

      <Section title="Market">
        <Field label="Countries" htmlFor="countries" path="countries" hint="Pick in order of priority. The first one is your main market.">
          <MultiSelect
            id="countries"
            options={COUNTRY_OPTIONS}
            value={b.countries}
            onChange={(countries) => set({ countries })}
            placeholder="Select countries"
            searchPlaceholder="Search countries…"
            max={30}
          />
        </Field>
        <Field label="Cities" htmlFor="cities" optional path="cities" hint="Leave empty if you sell nationwide.">
          <TextInput id="cities" value={b.cities} onValueChange={(cities) => set({ cities })} placeholder="e.g. Valletta, Sliema" />
        </Field>
        <div className={row}>
          <Field label="Content language" htmlFor="language" path="language">
            <Select id="language" options={LANGUAGE_OPTIONS} value={b.language} onValueChange={(language) => set({ language })} />
          </Field>
          <Field label="Timezone" htmlFor="timezone" path="timezone">
            <Select
              id="timezone"
              searchable
              options={zones}
              value={b.timezone}
              placeholder="Pick a timezone"
              searchPlaceholder="Search timezones…"
              onValueChange={(timezone) => set({ timezone })}
            />
          </Field>
        </div>
      </Section>

      <Section title="What's your main goal?" description="Sets the mix of content and which call to action we use.">
        <Field path="primaryGoal">
          <ChoiceCards label="Main goal" options={GOAL_OPTIONS} value={b.primaryGoal} onChange={(primaryGoal) => set({ primaryGoal })} />
        </Field>
      </Section>
    </StepLayout>
  );
}
