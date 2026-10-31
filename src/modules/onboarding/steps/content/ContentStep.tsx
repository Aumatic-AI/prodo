"use client";

import { MAX_GOALS, soundNeeds, type Goal, type ImageStyle, type VideoStyle } from "@/core/onboarding/options";
import type { MediaUpload } from "@/core/onboarding/schemas";
import { ChoiceCards, Pills, RankedChoiceCards } from "@/components/kit/choices";
import { MediaUploader, isVideoKey } from "@/components/kit/MediaUploader";
import { TagInput } from "@/components/kit/TagInput";
import { OptionalBadge, Section } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { GOAL_OPTIONS, MUSIC_OPTIONS, STEP_META } from "../../config";
import { LOGO_OPTIONS, MIX_OPTIONS, PEOPLE_OPTIONS } from "./labels";
import { PostingPlan } from "./PostingPlan";
import { StylePicker } from "./StylePicker";
import { VoicePicker } from "./VoicePicker";
import { BrandsSection } from "./BrandsSection";

/** Uploads that can be photos or videos remember which one they are. */
const asMedia = (upload: { id: string; key: string }): MediaUpload => ({ ...upload, video: isVideoKey(upload.key) });

// What a website can't tell us: goals, formats, people, sound, and what the client likes.
// Later sections hide when an earlier answer makes them pointless (images only → no video questions).
export function ContentStep() {
  const { value: v, update } = useSlice("content");
  const service = useOnboarding((s) => s.draft.basics.businessType === "service");
  const language = useOnboarding((s) => s.draft.basics.language);
  const set = (patch: Partial<typeof v>) => update("content", patch);
  const videos = v.mix !== "images";
  const sound = soundNeeds(v.videoStyles as VideoStyle[]);
  // Errors on one pasted link (e.g. "referenceLinks.2") show under the list
  const linkError = useOnboarding((s) => Object.entries(s.errors).find(([path]) => path.startsWith("referenceLinks."))?.[1]);

  return (
    <StepLayout step="content" title={STEP_META.content.title} lead={STEP_META.content.lead}>
      <Section title="What are your main goals?" description={`Pick up to ${MAX_GOALS}, most important first. The first is your main goal and drives most posts.`}>
        <Field path="goals">
          <RankedChoiceCards label="Main goals" options={GOAL_OPTIONS} value={v.goals as Goal[]} max={MAX_GOALS} onChange={(goals) => set({ goals })} />
        </Field>
      </Section>

      <Section title="Images or videos?" description="Sets the balance of formats each week.">
        <Field path="mix">
          <ChoiceCards label="Images or videos" options={MIX_OPTIONS} value={v.mix} onChange={(mix) => set({ mix })} />
        </Field>
      </Section>

      <Section title="Where and how often to post" description="Sets how many posts we plan each week." path="postsPerWeek">
        <PostingPlan imagesOnly={!videos} />
      </Section>

      <Section title="What kind of posts do you want?" description="Tap the ones you like, starting with your favourite. We'll make more of your top picks." path="imageStyles">
        <StylePicker
          videos={videos}
          service={service}
          value={{ imageStyles: v.imageStyles as ImageStyle[], videoStyles: v.videoStyles as VideoStyle[] }}
          onChange={set}
        />
      </Section>

      <Section title="People in your posts" description="Decides which photo and video styles Prodo can make for you.">
        <Field label="Should people appear in your posts?" path="people">
          <ChoiceCards label="People in your posts" options={PEOPLE_OPTIONS} value={v.people} onChange={(people) => set({ people })} />
        </Field>
        {v.people === "real" && (
          <Field
            label="Photos of these people"
            optional
            path="peoplePhotos"
            hint="You, your team or customers who agreed to appear. Clear photos of faces and full body. Prodo uses them so the same people appear in your posts."
          >
            <MediaUploader purpose="photo" max={10} value={v.peoplePhotos} onChange={(peoplePhotos) => set({ peoplePhotos })} />
          </Field>
        )}
      </Section>

      {videos && (sound.voice || sound.music) && (
        <Section
          title="Voice and music for videos"
          description={v.videoStyles.length ? "Only what your video styles use." : "Pick video styles above and we'll only ask what they need."}
        >
          {sound.voice && <VoicePicker language={language} value={{ voiceId: v.voiceId, voiceName: v.voiceName }} onChange={set} />}
          {sound.music && (
            <Field label="Music mood">
              <Pills label="Music mood" options={MUSIC_OPTIONS} value={v.musicMood} onChange={(musicMood) => set({ musicMood })} />
            </Field>
          )}
        </Section>
      )}

      <Section title="Logo on your posts" description="Your logo comes from Basics.">
        <Field path="logo">
          <ChoiceCards label="Logo on your posts" options={LOGO_OPTIONS} value={v.logo} onChange={(logo) => set({ logo })} />
        </Field>
      </Section>

      <Section title="Your own photos and videos" badge={<OptionalBadge />} description="Real shots build trust. Prodo mixes them into your posts alongside what it makes.">
        <Field path="ownMedia" hint="Your place, team, products or process. Up to 30.">
          <MediaUploader purpose="media" max={30} value={v.ownMedia} extend={asMedia} onChange={(ownMedia) => set({ ownMedia })} />
        </Field>
      </Section>

      <Section title="Reference posts and ads" badge={<OptionalBadge />} description="Posts or ads whose look you'd like. The clearest way to show your style.">
        <Field path="references" hint="Images, screenshots or videos you like. Up to 8.">
          <MediaUploader purpose="reference" max={8} value={v.references} extend={asMedia} onChange={(references) => set({ references })} />
        </Field>
        <Field
          label="Or paste links"
          htmlFor="reference-links"
          path="referenceLinks"
          error={linkError}
          hint="Your own best posts or anyone else's. We study their look, hook and pacing; we never copy them."
        >
          <TagInput
            id="reference-links"
            value={v.referenceLinks}
            onChange={(referenceLinks) => set({ referenceLinks })}
            placeholder="Paste an Instagram, TikTok or YouTube link and press Enter"
            max={10}
          />
        </Field>
      </Section>

      <Section
        title="Brands to learn from"
        badge={<OptionalBadge />}
        path="brands"
        description="Competitors you sell against, or brands from any industry whose look you like. Fewer than 2 competitors? We'll find some. Their claims are never reused as yours."
      >
        <BrandsSection />
      </Section>
    </StepLayout>
  );
}
