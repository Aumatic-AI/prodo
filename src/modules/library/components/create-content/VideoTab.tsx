"use client";

import { useState } from "react";
import { Field } from "@/components/kit/Field";
import { Select } from "@/components/kit/Select";
import { ChoiceCards, Pills } from "@/components/kit/choices";
import { row } from "@/components/kit/styles";
import type { Upload } from "@/core/onboarding/schemas";
import { useProfile } from "@/modules/settings/hooks/useProfile";
import { useGenerateMedia } from "../../hooks/useMedia";
import { AspectPicker } from "./AspectPicker";
import { FormFooter } from "./FormFooter";
import { IdeaField } from "./IdeaField";
import { NO_PRODUCT, ProductPicker, hasProduct, productFields } from "./ProductPicker";
import { ReferencePhoto } from "./ReferencePhoto";
import { VoiceField, type VoiceChoice } from "./VoiceField";
import { AUDIO, CHARACTERS, DURATIONS, LANGUAGES, languageFor, type Ratio } from "./options";

export function VideoTab({ onDone }: { onDone: () => void }) {
  const { data: profile } = useProfile();
  const generate = useGenerateMedia();

  const [idea, setIdea] = useState("");
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [duration, setDuration] = useState<"15" | "30" | "45">("30");
  const [product, setProduct] = useState(NO_PRODUCT);
  const [audio, setAudio] = useState<"Voiceover" | "No Voice">("Voiceover");
  const [character, setCharacter] = useState<"female" | "male">("female");
  const [language, setLanguage] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceChoice | null>(null);
  const [reference, setReference] = useState<Upload[]>([]);

  // Start from the brand's saved voice and language until the user picks
  const brandVoice = profile?.voice_id ? { id: profile.voice_id, name: String(profile.onboarding?.voiceName ?? "Brand voice") } : null;
  const chosenVoice = voice ?? brandVoice;
  const chosenLanguage = language ?? languageFor(profile?.language);
  const withVoice = audio === "Voiceover";

  async function submit() {
    await generate.mutateAsync({
      type: "video",
      idea: idea.trim(),
      aspect_ratio: ratio,
      duration_sec: Number(duration),
      audio_style: audio,
      voice_id: withVoice ? chosenVoice?.id : undefined,
      voice_name: withVoice ? chosenVoice?.name : undefined,
      character: withVoice ? character : undefined,
      language: chosenLanguage,
      reference_image_key: reference[0]?.key,
      ...productFields(product),
    });
    onDone();
  }

  const missing = !idea.trim() ? "Add your idea" : !hasProduct(product) ? "Pick a product or service" : withVoice && !chosenVoice ? "Pick a voice" : null;

  return (
    <div className="flex flex-col gap-6">
      <IdeaField value={idea} onChange={setIdea} format="video" placeholder="e.g. A quick before-and-after showing how our cleaning service transforms a messy kitchen" />
      <ProductPicker value={product} onChange={setProduct} required />
      <Field label="Size">
        <AspectPicker value={ratio} onChange={setRatio} />
      </Field>
      <div className={row}>
        <Field label="Length">
          <Pills options={DURATIONS} value={duration} onChange={setDuration} label="Length" />
        </Field>
        <Field label="Language" htmlFor="language">
          <Select id="language" value={chosenLanguage} onValueChange={setLanguage} options={LANGUAGES} />
        </Field>
      </div>
      <Field label="Sound">
        <ChoiceCards options={AUDIO} value={audio} onChange={setAudio} label="Sound" />
      </Field>
      {withVoice && (
        <>
          <VoiceField value={chosenVoice} onChange={setVoice} languageCode={profile?.language ?? "en"} />
          <Field label="Who appears on screen">
            <Pills options={CHARACTERS} value={character} onChange={setCharacter} label="Who appears on screen" />
          </Field>
        </>
      )}
      <ReferencePhoto value={reference} onChange={setReference} hint="A product or person photo keeps them the same in every scene." />
      <FormFooter
        note={missing ?? "Takes about 5–10 minutes. You can close this window."}
        label="Generate video"
        busy={generate.isPending}
        disabled={!!missing}
        error={generate.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
