"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/kit/Card";
import { Field } from "@/components/kit/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { MultiSelect } from "@/components/kit/MultiSelect";
import { ChoiceCards } from "@/components/kit/choices";
import { LogoUploader } from "@/components/kit/LogoUploader";
import { SaveBar } from "@/components/kit/SaveBar";
import { Skeleton } from "@/components/kit/Skeleton";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { row } from "@/components/kit/styles";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { LIMITS } from "@/config/limits";
import { basicsSchema, toFieldErrors, type BasicsDraft, type FieldErrors } from "@/core/onboarding/schemas";
import { useSession } from "@/stores/SessionStoreProvider";
import { GOAL_OPTIONS, LANGUAGE_OPTIONS, timezoneOptions } from "@/modules/onboarding/config";
import { SocialLinks } from "@/modules/onboarding/steps/basics/SocialLinks";
import { useBusinessProfile, useSaveBusinessProfile } from "../hooks/useBusinessProfile";

/** The business basics from onboarding, editable any time. Same fields and checks as onboarding's first step. */
export function BusinessProfileForm() {
  const { data: saved, isLoading, error } = useBusinessProfile();
  const save = useSaveBusinessProfile();
  const updateBusiness = useSession((s) => s.updateBusiness);
  const [form, setForm] = useState<BasicsDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const zones = useMemo(() => timezoneOptions(), []);

  useEffect(() => {
    if (saved) setForm(saved);
  }, [saved]);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !form || !saved) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const set = (patch: Partial<BasicsDraft>) => setForm({ ...form, ...patch });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function submit() {
    const parsed = basicsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const fresh = await save.mutateAsync(parsed.data);
    updateBusiness({ name: fresh.name, logoKey: fresh.logoKey });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Your business" actions={<Badge tone="neutral">Sells {saved.businessType === "service" ? "services" : "products"}</Badge>}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Field label="Logo">
            <LogoUploader value={form.logoKey} onChange={(logoKey) => set({ logoKey })} />
          </Field>
          <div className="flex flex-col gap-4">
            <Field label="Business name" htmlFor="name" error={errors.name}>
              <TextInput id="name" value={form.name} onValueChange={(name) => set({ name })} autoComplete="organization" />
            </Field>
            <Field label="Website" htmlFor="website" error={errors.website}>
              <TextInput id="website" type="url" inputMode="url" value={form.website} onValueChange={(website) => set({ website })} placeholder="https://" />
            </Field>
          </div>
        </div>
        <Field
          className="mt-5"
          label="About the business"
          htmlFor="description"
          error={errors.description}
          hint={`Agents read this alongside your website. ${form.description.length} / ${LIMITS.descriptionMaxChars}`}
        >
          <TextArea id="description" rows={5} value={form.description} maxLength={LIMITS.descriptionMaxChars} onValueChange={(description) => set({ description })} />
        </Field>
      </Card>

      <Card title="Online profiles" description="The Social & Market Analyst reads public posts from Instagram, TikTok and YouTube.">
        <SocialLinks value={form.socials} onChange={(socials) => set({ socials })} errorFor={(platform) => errors[`socials.${platform}`]} />
      </Card>

      <Card title="Market">
        <div className="flex flex-col gap-4">
          <Field label="Countries" htmlFor="countries" error={errors.countries} hint="In order of priority. The first one is your main market.">
            <MultiSelect
              id="countries"
              options={COUNTRY_OPTIONS}
              value={form.countries}
              onChange={(countries) => set({ countries })}
              placeholder="Select countries"
              searchPlaceholder="Search countries…"
              max={30}
            />
          </Field>
          <Field label="Cities" htmlFor="cities" optional error={errors.cities} hint="Leave empty if you sell nationwide.">
            <TextInput id="cities" value={form.cities} onValueChange={(cities) => set({ cities })} />
          </Field>
          <div className={row}>
            <Field label="Content language" htmlFor="language" error={errors.language}>
              <Select id="language" options={LANGUAGE_OPTIONS} value={form.language} onValueChange={(language) => set({ language })} />
            </Field>
            <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
              <Select
                id="timezone"
                searchable
                options={zones}
                value={form.timezone}
                placeholder="Pick a timezone"
                searchPlaceholder="Search timezones…"
                onValueChange={(timezone) => set({ timezone })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Main goal" description="Sets the mix of content and the call to action agents use.">
        <Field error={errors.primaryGoal}>
          <ChoiceCards label="Main goal" options={GOAL_OPTIONS} value={form.primaryGoal} onChange={(primaryGoal) => set({ primaryGoal })} />
        </Field>
      </Card>

      <SaveBar
        show={dirty}
        saving={save.isPending}
        error={Object.keys(errors).length ? "Some fields need attention" : save.error?.message}
        onSave={submit}
        onDiscard={() => {
          setForm(saved);
          setErrors({});
        }}
      />
    </div>
  );
}
