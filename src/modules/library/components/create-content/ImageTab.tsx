"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useGenerateMedia, useUploadReferenceImage } from "../../hooks/useMedia";
import { useProfile } from "@/modules/settings/hooks/useProfile";
import { IdeaField } from "./IdeaField";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import { ASPECT_RATIOS } from "@/config/video-options";

export function ImageTab({ onSuccess }: { onSuccess: () => void }) {
  const [idea, setIdea] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [useLogo, setUseLogo] = useState(true);
  const [product, setProduct] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);

  const generate = useGenerateMedia();
  const uploadRef = useUploadReferenceImage();
  const { data: profile } = useProfile();
  const hasLogo = !!profile?.logo_key;

  const products: { value: string; label: string }[] = (profile as any)?.products
    ? (profile as any).products.map((p: any) => ({ value: typeof p === "string" ? p : p.name, label: typeof p === "string" ? p : p.name }))
    : [];

  const resolvedProduct = product === "__other__" ? customProduct : product;

  function handleRefSelect(file: File | null) {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefFile(file);
    setRefPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleCreate() {
    let referenceImageKey: string | undefined;
    if (refFile) {
      const result = await uploadRef.mutateAsync(refFile);
      referenceImageKey = result.key;
    }

    await generate.mutateAsync({
      type: "image",
      idea,
      aspect_ratio: aspectRatio,
      use_logo: useLogo,
      product: resolvedProduct || undefined,
      reference_image_key: referenceImageKey,
    });
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <IdeaField
        value={idea}
        onChange={setIdea}
        format="image"
        placeholder="A vibrant lifestyle photo showcasing your brand in action..."
        required
      />

      <SegmentedControl
        label="Aspect ratio"
        options={ASPECT_RATIOS}
        value={aspectRatio}
        onChange={setAspectRatio}
      />

      {products.length > 0 && (
        <div>
          <Dropdown
            label="Product"
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
      )}

      {hasLogo && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Add business logo</span>
          <Switch checked={useLogo} onCheckedChange={setUseLogo} />
        </div>
      )}

      <ReferenceImagePicker preview={refPreview} onSelect={handleRefSelect} />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleCreate}
          loading={uploadRef.isPending || generate.isPending}
          disabled={!idea.trim() || uploadRef.isPending || generate.isPending}
        >
          Generate Image
        </Button>
      </div>

      {(uploadRef.error || generate.error) && (
        <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
          {uploadRef.error?.message || generate.error?.message}
        </p>
      )}
    </div>
  );
}
