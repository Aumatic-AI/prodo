"use client";

import { TONE_AXES } from "@/core/onboarding/options";
import { OptionalBadge, Section } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { Pills } from "@/components/kit/choices";
import { Slider } from "@/components/kit/controls";
import { TagInput } from "@/components/kit/TagInput";
import { StepLayout } from "../../components/shell/StepLayout";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { MUSIC_OPTIONS, STEP_META, TONE_LABELS, WHY_WE_ASK } from "../../config";
import { CompetitorsSection } from "./CompetitorsSection";
import { PostingPlan } from "./PostingPlan";
import { VoicePicker } from "./VoicePicker";
import { AutopilotSection } from "./AutopilotSection";
import { row } from "@/components/kit/styles";

export function StyleStep() {
  const { value: v, update } = useSlice("style");
  const set = (patch: Partial<typeof v>) => update("style", patch);
  const brands = [0, 1, 2].map((i) => v.likedBrands[i] ?? "");

  return (
    <StepLayout step="style" title={STEP_META.style.title} lead={STEP_META.style.lead} why={WHY_WE_ASK.style}>
      <Section title="Tone of voice" description="Slide to where your brand sits. Shapes every caption and voice-over.">
        <div className="flex flex-col gap-[22px]">
          {TONE_AXES.map((axis) => (
            <Slider
              key={axis}
              id={`tone-${axis}`}
              left={TONE_LABELS[axis].left}
              right={TONE_LABELS[axis].right}
              value={v.tone[axis]}
              onChange={(n) => set({ tone: { ...v.tone, [axis]: n } })}
            />
          ))}
        </div>
      </Section>

      <Section title="3 brands you admire" badge={<OptionalBadge />} description="Any industry. Helps us understand the look and feel you like.">
        <div className={row}>
          {brands.map((brand, i) => (
            <Field key={i} label={`Brand ${i + 1}`} htmlFor={`brand-${i}`} path={`likedBrands.${i}`}>
              <TextInput
                id={`brand-${i}`}
                value={brand}
                placeholder={["e.g. Aesop", "e.g. Apple", "e.g. Glossier"][i]}
                onValueChange={(text) => set({ likedBrands: brands.map((b, j) => (j === i ? text : b)) })}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Your competitors" description="Fewer than 2? We'll suggest some. Their claims are never reused as yours." path="competitors">
        <CompetitorsSection />
      </Section>

      <Section title="Words and rules" description="Every post is checked against these before it goes out. This is a hard rule.">
        <Field label="Never say these" htmlFor="avoid" path="avoidWords" hint="Press Enter after each word or phrase.">
          <TagInput id="avoid" value={v.avoidWords} onChange={(avoidWords) => set({ avoidWords })} placeholder="e.g. cheapest, guaranteed, cure" />
        </Field>
        <Field label="Required disclaimers" htmlFor="disclaimers" path="disclaimers" optional hint="Added to posts that need them, e.g. 'Results may vary.'">
          <TagInput id="disclaimers" value={v.disclaimers} onChange={(disclaimers) => set({ disclaimers })} placeholder="Type a disclaimer and press Enter" max={10} />
        </Field>
      </Section>

      <Section title="Where and how often to post" description="Sets how many posts we plan each week." path="postsPerWeek">
        <PostingPlan />
      </Section>

      <Section title="Voice and music for videos">
        <VoicePicker />
        <Field label="Music mood">
          <Pills label="Music mood" options={MUSIC_OPTIONS} value={v.musicMood} onChange={(musicMood) => set({ musicMood })} />
        </Field>
      </Section>

      <Section title="How much should Prodo do on its own?" description="You can change this anytime in Settings.">
        <AutopilotSection />
      </Section>
    </StepLayout>
  );
}
