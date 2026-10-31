"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/kit/Card";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { ChoiceCards, Pills } from "@/components/kit/choices";
import { SaveBar } from "@/components/kit/SaveBar";
import { Skeleton } from "@/components/kit/Skeleton";
import { Alert } from "@/components/kit/Alert";
import { contentSettingsSchema, toFieldErrors, type ContentSettingsDraft, type FieldErrors } from "@/core/onboarding/schemas";
import { soundNeeds, type ImageStyle, type VideoStyle } from "@/core/onboarding/options";
import { CTA_OPTIONS, MUSIC_OPTIONS } from "@/modules/onboarding/config";
import { LOGO_OPTIONS, MIX_OPTIONS, PEOPLE_OPTIONS } from "@/modules/onboarding/steps/content/labels";
import { StylePicker } from "@/modules/onboarding/steps/content/StylePicker";
import { VoicePicker } from "@/modules/onboarding/steps/content/VoicePicker";
import { useContentSettings, useSaveContentSettings } from "../hooks/useContentSettings";

/**
 * The "Your content" choices from onboarding, editable any time: images or videos, post styles,
 * people, voice and music, logo, and where customers go. The agents follow them from the next plan.
 */
export function ContentSettingsForm() {
  const { data, isLoading, error } = useContentSettings();
  const save = useSaveContentSettings();
  const [form, setForm] = useState<ContentSettingsDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (data) setForm(data.values);
  }, [data]);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !data || !form) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const set = (patch: Partial<ContentSettingsDraft>) => setForm({ ...form, ...patch });
  const dirty = JSON.stringify(form) !== JSON.stringify(data.values);
  const videos = form.mix !== "images";
  const sound = soundNeeds(form.videoStyles as VideoStyle[]);
  const cta = CTA_OPTIONS.find((o) => o.value === form.cta);

  async function submit() {
    const parsed = contentSettingsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    await save.mutateAsync(parsed.data);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Images or videos?" description="Sets the balance of formats each week. Images only also stops posts to TikTok and YouTube.">
        <Field error={errors.mix}>
          <ChoiceCards label="Images or videos" options={MIX_OPTIONS} value={form.mix} onChange={(mix) => set({ mix })} />
        </Field>
      </Card>

      <Card title="Kinds of posts" description="Your first pick is used most and the rest are mixed in. Nothing picked: Prodo tries a wide mix and learns what works.">
        <Field error={errors.imageStyles ?? errors.videoStyles}>
          <StylePicker
            videos={videos}
            service={data.service}
            value={{ imageStyles: form.imageStyles as ImageStyle[], videoStyles: form.videoStyles as VideoStyle[] }}
            onChange={set}
          />
        </Field>
      </Card>

      <Card title="People in your posts" description="Decides which photo and video styles Prodo makes. Photos of your team live in Brand → Assets.">
        <Field error={errors.people}>
          <ChoiceCards label="People in your posts" options={PEOPLE_OPTIONS} value={form.people} onChange={(people) => set({ people })} />
        </Field>
      </Card>

      {videos && (sound.voice || sound.music) && (
        <Card title="Voice and music for videos" description="Only what your video styles use.">
          <div className="flex flex-col gap-5">
            {sound.voice && <VoicePicker language={data.language} value={{ voiceId: form.voiceId, voiceName: form.voiceName }} onChange={set} />}
            {sound.music && (
              <Field label="Music mood">
                <Pills label="Music mood" options={MUSIC_OPTIONS} value={form.musicMood} onChange={(musicMood) => set({ musicMood })} />
              </Field>
            )}
          </div>
        </Card>
      )}

      <Card title="Logo on your posts" description="Your logo is set in Business profile.">
        <Field error={errors.logo}>
          <ChoiceCards label="Logo on your posts" options={LOGO_OPTIONS} value={form.logo} onChange={(logo) => set({ logo })} />
        </Field>
      </Card>

      <Card title="Where should customers go?" description="The one next step on every post: every call to action and caption leads there.">
        <div className="flex flex-col gap-4">
          <Field error={errors.cta}>
            <ChoiceCards label="Where should customers go?" options={CTA_OPTIONS} value={form.cta} onChange={(c) => set({ cta: c })} />
          </Field>
          {cta && (
            <Field label={cta.field} htmlFor="cta-link" error={errors[`ctaLinks.${cta.value}`]}>
              <TextInput
                id="cta-link"
                type={cta.phone ? "tel" : "url"}
                inputMode={cta.phone ? "tel" : "url"}
                value={form.ctaLinks[cta.value]}
                placeholder={cta.placeholder}
                onValueChange={(v) => set({ ctaLinks: { ...form.ctaLinks, [cta.value]: v } })}
              />
            </Field>
          )}
        </div>
      </Card>

      <SaveBar
        show={dirty}
        saving={save.isPending}
        error={Object.keys(errors).length ? "Some fields need attention" : save.error?.message}
        onSave={submit}
        onDiscard={() => {
          setForm(data.values);
          setErrors({});
        }}
      />
    </div>
  );
}
