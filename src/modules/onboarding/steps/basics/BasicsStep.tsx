"use client";

import { useEffect, useState } from "react";
import { TONE_AXES } from "@/core/onboarding/options";
import { AiDraftBadge, FromSiteBadge, Section } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { ScanWait, useScanWait } from "../../components/ScanWait";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { MultiSelect } from "@/components/kit/MultiSelect";
import { ChoiceCards } from "@/components/kit/choices";
import { Slider } from "@/components/kit/controls";
import { TagInput } from "@/components/kit/TagInput";
import { LogoUploader } from "@/components/kit/LogoUploader";
import { BRAND_COLORS, ColorTile } from "@/components/kit/ColorTile";
import { FontSelect } from "@/components/kit/FontSelect";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import {
  BUSINESS_TYPE_OPTIONS,
  CTA_OPTIONS,
  CURRENCY_OPTIONS,
  INDUSTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  STEP_META,
  TONE_LABELS,
  timezoneOptions,
} from "../../config";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { LIMITS } from "@/config/limits";
import { SocialLinks } from "./SocialLinks";
import { row } from "@/components/kit/styles";

// One shared empty list: a new [] on every read would make the store selector re-render forever
const NONE_FILLED: string[] = [];

export function BasicsStep() {
  const { value: b, update } = useSlice("basics");
  const set = (patch: Partial<typeof b>) => update("basics", patch);
  const errors = useOnboarding((s) => s.errors);
  const filled = useOnboarding((s) => s.draft.scan?.filled ?? NONE_FILLED);
  const { waiting, skip } = useScanWait();
  // A section gets the website badge when the scan filled any of its fields
  const fromSite = (...fields: string[]) => (fields.some((f) => filled.includes(f)) ? <FromSiteBadge /> : undefined);
  const cta = CTA_OPTIONS.find((o) => o.value === b.cta);

  // Timezones come from the browser, so build the list after mount
  const [zones, setZones] = useState(() => (b.timezone ? [{ value: b.timezone, label: b.timezone }] : []));
  useEffect(() => {
    setZones(timezoneOptions());
    if (!b.timezone) set({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepLayout step="basics" title={STEP_META.basics.title} lead={STEP_META.basics.lead} primaryAction={waiting ? <span /> : undefined}>
      {waiting ? (
        <ScanWait onSkip={skip} />
      ) : (
        <>
          <Section title="Your business" badge={fromSite("name", "logoKey", "description")}>
            <Field label="Business name" htmlFor="name" path="name">
              <TextInput id="name" value={b.name} onValueChange={(name) => set({ name })} placeholder="e.g. your shop or company name" autoComplete="organization" />
            </Field>
            <Field label="Logo" path="logoKey">
              <LogoUploader value={b.logoKey} onChange={(logoKey) => set({ logoKey })} />
            </Field>
            <Field
              label={
                <span className="inline-flex flex-wrap items-center gap-2">
                  Describe your business in 2–3 lines {filled.includes("description") && <AiDraftBadge />}
                </span>
              }
              htmlFor="description"
              path="description"
              hint={`What you sell, who it's for, and what makes you different. ${b.description.length} / ${LIMITS.descriptionMaxChars}`}
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

          <Section title="What do you sell?" description="This decides the next step and which ad formats fit you best." badge={fromSite("businessType")}>
            <Field path="businessType">
              <ChoiceCards label="What do you sell?" options={BUSINESS_TYPE_OPTIONS} value={b.businessType} onChange={(businessType) => set({ businessType })} />
            </Field>
          </Section>

          <Section title="Your brand look" description="Every design uses these, so check they match your brand." badge={fromSite("colors", "fonts")}>
            <Field label="Brand colours" hint="From your logo and website. Click a colour to change it.">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
                {BRAND_COLORS.map(([key, label, note]) => (
                  <ColorTile key={key} label={label} note={note} value={b.colors[key]} onChange={(v) => set({ colors: { ...b.colors, [key]: v ?? (key === "bg" || key === "text" ? b.colors[key] : null) } })} />
                ))}
              </div>
              {Object.keys(errors).some((k) => k.startsWith("colors.")) && <span className="text-[13px] font-medium text-ob-danger">Use colours like #1A2B3C</span>}
            </Field>
            <div className={row}>
              <Field label="Headings font" htmlFor="font-heading" path="fonts.heading">
                <FontSelect id="font-heading" role="heading" value={b.fonts.heading} onChange={(heading) => set({ fonts: { ...b.fonts, heading } })} />
              </Field>
              <Field label="Text font" htmlFor="font-body" path="fonts.body">
                <FontSelect id="font-body" role="body" value={b.fonts.body} onChange={(body) => set({ fonts: { ...b.fonts, body } })} />
              </Field>
            </div>
          </Section>

          <Section title="Where we can find you" badge={fromSite("socials")}>
            <Field label="Website" htmlFor="website" path="website" hint="We read up to 15 key pages: products, services, about, pricing, FAQ, reviews.">
              <TextInput id="website" type="url" inputMode="url" value={b.website} onValueChange={(website) => set({ website })} placeholder="https://" />
            </Field>
            <SocialLinks value={b.socials} onChange={(socials) => set({ socials })} errorFor={(platform) => errors[`socials.${platform}`]} />
          </Section>

          <Section title="Where should customers go?" description="The one next step on every post." badge={fromSite("cta")}>
            <Field path="cta">
              <ChoiceCards label="Where should customers go?" options={CTA_OPTIONS} value={b.cta} onChange={(c) => set({ cta: c })} />
            </Field>
            {cta && (
              <Field label={cta.field} htmlFor="cta-link" path={`ctaLinks.${cta.value}`}>
                <TextInput
                  id="cta-link"
                  type={cta.phone ? "tel" : "url"}
                  inputMode={cta.phone ? "tel" : "url"}
                  value={b.ctaLinks[cta.value]}
                  placeholder={cta.placeholder}
                  onValueChange={(v) => set({ ctaLinks: { ...b.ctaLinks, [cta.value]: v } })}
                />
              </Field>
            )}
          </Section>

          <Section title="Market" badge={fromSite("countries", "cities", "language", "industry", "currency")}>
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
            <div className={row}>
              <Field label="Industry" htmlFor="industry" path="industry" hint="Health, beauty and finance get extra ad-rule checks.">
                <Select
                  id="industry"
                  searchable
                  options={INDUSTRY_OPTIONS}
                  value={b.industry ?? ""}
                  placeholder="Pick your industry"
                  searchPlaceholder="Search industries…"
                  onValueChange={(industry) => set({ industry: industry as typeof b.industry })}
                />
              </Field>
              <Field label="Currency" htmlFor="currency" path="currency" hint="Used for every price.">
                <Select id="currency" searchable options={CURRENCY_OPTIONS} value={b.currency} searchPlaceholder="Search currencies…" onValueChange={(currency) => set({ currency })} />
              </Field>
            </div>
          </Section>

          <Section
            title="Tone of voice"
            description={filled.includes("tone") ? "Set from how your website already writes. Adjust it if it doesn't sound like you." : "Slide to where your brand sits. Shapes every caption and voice-over."}
            badge={filled.includes("tone") ? <AiDraftBadge /> : undefined}
          >
            <div className="flex flex-col gap-[22px]">
              {TONE_AXES.map((axis) => (
                <Slider
                  key={axis}
                  id={`tone-${axis}`}
                  left={TONE_LABELS[axis].left}
                  right={TONE_LABELS[axis].right}
                  value={b.tone[axis]}
                  onChange={(n) => set({ tone: { ...b.tone, [axis]: n } })}
                />
              ))}
            </div>
          </Section>

          <Section title="Words and rules" description="Every post is checked against these before it goes out. This is a hard rule." badge={fromSite("disclaimers")}>
            <Field label="Never say these" htmlFor="avoid" path="avoidWords" hint="Press Enter after each word or phrase.">
              <TagInput id="avoid" value={b.avoidWords} onChange={(avoidWords) => set({ avoidWords })} placeholder="e.g. cheapest, guaranteed, cure" />
            </Field>
            <Field
              label="Required disclaimers"
              htmlFor="disclaimers"
              path="disclaimers"
              optional
              hint={filled.includes("disclaimers") ? "Found on your website. Added to posts that need them." : "Added to posts that need them, e.g. 'Results may vary.'"}
            >
              <TagInput id="disclaimers" value={b.disclaimers} onChange={(disclaimers) => set({ disclaimers })} placeholder="Type a disclaimer and press Enter" max={10} />
            </Field>
          </Section>
        </>
      )}
    </StepLayout>
  );
}
