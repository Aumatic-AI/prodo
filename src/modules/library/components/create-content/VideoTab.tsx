"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tabs } from "@/components/ui/Tabs";
import { VoiceExplorerModal } from "@/components/global/VoiceExplorerModal";
import { useGenerateMedia, useUploadReferenceImage } from "../../hooks/useMedia";
import { useOfferings } from "@/modules/settings/hooks/useOfferings";
import { IdeaField } from "./IdeaField";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import {
  ASPECT_RATIOS,
  DURATIONS,
  AUDIO_STYLES,
  CHARACTERS,
  LANGUAGES,
} from "@/config/video-options";
import { Mic } from "lucide-react";

export function VideoTab({ onSuccess }: { onSuccess: () => void }) {
  const [idea, setIdea] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("30");
  const [product, setProduct] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [audioStyle, setAudioStyle] = useState("Voiceover");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [character, setCharacter] = useState("female");
  const [language, setLanguage] = useState("en");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);

  const generate = useGenerateMedia();
  const uploadRef = useUploadReferenceImage();

  function handleRefSelect(file: File | null) {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefFile(file);
    setRefPreview(file ? URL.createObjectURL(file) : null);
  }

  const { data: offerings } = useOfferings();
  const products = (offerings || []).map((o) => ({ value: o.id, label: o.name }));

  // A saved offering is sent by id; "Other" is sent as free text
  const offeringId = product && product !== "__other__" ? product : undefined;
  const productName = product === "__other__" ? customProduct.trim() || undefined : undefined;

  async function handleCreate() {
    let referenceImageKey: string | undefined;
    if (refFile) {
      const result = await uploadRef.mutateAsync(refFile);
      referenceImageKey = result.key;
    }

    const hasVoice = audioStyle === "Voiceover";

    await generate.mutateAsync({
      type: "video",
      idea,
      aspect_ratio: aspectRatio,
      duration_sec: parseInt(duration),
      offering_id: offeringId,
      product_name: productName,
      audio_style: audioStyle,
      voice_id: hasVoice ? voiceId || undefined : undefined,
      voice_name: hasVoice ? voiceName || undefined : undefined,
      character: hasVoice ? character : undefined,
      language,
      reference_image_key: referenceImageKey,
    });
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <IdeaField
        value={idea}
        onChange={setIdea}
        format="video"
        placeholder="A short testimonial-style video about your product's impact..."
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <SegmentedControl
          label="Aspect ratio"
          options={ASPECT_RATIOS}
          value={aspectRatio}
          onChange={setAspectRatio}
        />
        <Dropdown
          label="Duration"
          options={DURATIONS}
          value={duration}
          onChange={setDuration}
        />
      </div>

      <div>
        <Dropdown
          label="Product"
          required
          options={[
            ...products,
            { value: "__other__", label: "Other" },
          ]}
          value={product}
          onChange={(v) => { setProduct(v); if (v !== "__other__") setCustomProduct(""); }}
          placeholder="Select a product..."
        />
        {product === "__other__" && (
          <Input
            className="mt-2"
            placeholder="Enter product or service name..."
            value={customProduct}
            onChange={(e) => setCustomProduct(e.target.value)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text mb-2">Audio style</p>
          <Tabs
            tabs={AUDIO_STYLES.map((s) => ({ value: s.value, label: s.label }))}
            value={audioStyle}
            onChange={setAudioStyle}
          />
        </div>

        {audioStyle === "Voiceover" && (
          <div>
            <p className="text-sm font-medium text-text mb-2">
              Voice<span className="text-danger"> *</span>
            </p>
            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              className={`flex items-center gap-3 w-full rounded-lg border transition-colors ${
                voiceId ? "border-default hover:border-strong" : "border-danger"
              }`}
              style={{ padding: "10px 14px", backgroundColor: "var(--color-page)" }}
            >
              <Mic className="w-4 h-4 text-secondary" />
              <span className={voiceName ? "text-sm text-text" : "text-sm text-secondary"}>
                {voiceName || "Choose a voice..."}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {audioStyle === "Voiceover" && (
          <Dropdown
            label="Character"
            options={CHARACTERS}
            value={character}
            onChange={setCharacter}
          />
        )}
        <Dropdown
          label="Language"
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
        />
      </div>

      <ReferenceImagePicker
        preview={refPreview}
        onSelect={handleRefSelect}
        hint="Upload a product or person photo to keep it consistent across every scene."
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleCreate}
          loading={uploadRef.isPending || generate.isPending}
          disabled={
            !idea.trim() ||
            (!offeringId && !productName) ||
            (audioStyle === "Voiceover" && !voiceId) ||
            uploadRef.isPending ||
            generate.isPending
          }
        >
          Generate Video
        </Button>
      </div>

      {(uploadRef.error || generate.error) && (
        <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
          {uploadRef.error?.message || generate.error?.message}
        </p>
      )}

      <VoiceExplorerModal
        open={showVoiceModal}
        onOpenChange={setShowVoiceModal}
        selectedVoiceId={voiceId}
        onSelectVoice={(id, name) => { setVoiceId(id); setVoiceName(name); }}
      />
    </div>
  );
}
