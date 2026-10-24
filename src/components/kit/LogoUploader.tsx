"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { UPLOAD_RULES } from "@/config/uploads";
import { useUpload } from "@/components/kit/useUpload";
import { button, hint } from "@/components/kit/styles";
import { FieldError } from "./Field";
import { publicUrl } from "@/components/kit/MediaUploader";

interface LogoUploaderProps {
  value: string | null;
  onChange: (key: string | null) => void;
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const upload = useUpload("logo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange((await upload(file)).key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-ob-md border border-ob-line bg-ob-sunken">
          {busy ? (
            <Loader2 size={22} className="animate-spin" aria-label="Uploading" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(value)} alt="Your logo" className="max-h-[80%] max-w-[80%] object-contain" />
          ) : (
            <ImageIcon size={26} className="text-ob-faint" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={busy} onClick={() => inputRef.current?.click()}>
              {value ? "Replace logo" : "Upload logo"}
            </button>
            {value && !busy && (
              <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => onChange(null)}>
                Remove
              </button>
            )}
          </div>
          <span className={hint}>{UPLOAD_RULES.logo.hint}. Transparent background works best.</span>
        </div>
      </div>
      <input ref={inputRef} type="file" hidden accept={UPLOAD_RULES.logo.types.join(",")} onChange={(e) => pick(e.target.files?.[0])} />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
