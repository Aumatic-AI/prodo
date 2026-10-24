"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SOCIAL_PLATFORMS } from "@/core/onboarding/options";
import { Field } from "@/components/kit/Field";
import { Select } from "@/components/kit/Select";
import { DEFAULT_SOCIALS, SOCIAL_LABELS } from "../../config";
import { button, control } from "@/components/kit/styles";

interface SocialLinksProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  /** Error for a platform link, e.g. errorFor("instagram") */
  errorFor?: (platform: string) => string | undefined;
}

/** One link per platform. The common four are always shown; others can be added. */
export function SocialLinks({ value, onChange, errorFor }: SocialLinksProps) {
  const [extra, setExtra] = useState<string[]>(() => Object.keys(value).filter((p) => !DEFAULT_SOCIALS.includes(p)));
  const shown = [...DEFAULT_SOCIALS, ...extra];
  const available = SOCIAL_PLATFORMS.filter((p) => !shown.includes(p));

  function remove(platform: string) {
    setExtra((e) => e.filter((p) => p !== platform));
    onChange(Object.fromEntries(Object.entries(value).filter(([p]) => p !== platform)));
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold text-ob-ink">Social profiles</span>
      {shown.map((platform) => (
        <Field key={platform} error={errorFor?.(platform)}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
            <span className="col-span-full text-sm text-ob-muted sm:col-span-1">{SOCIAL_LABELS[platform]}</span>
            <input
              className={control}
              type="url"
              inputMode="url"
              aria-label={`${SOCIAL_LABELS[platform]} profile link`}
              placeholder={`https://${platform === "twitter" ? "x" : platform}.com/yourhandle`}
              value={value[platform] ?? ""}
              onChange={(e) => onChange({ ...value, [platform]: e.target.value })}
            />
            {extra.includes(platform) ? (
              <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label={`Remove ${SOCIAL_LABELS[platform]}`} onClick={() => remove(platform)}>
                <X size={16} />
              </button>
            ) : (
              <span />
            )}
          </div>
        </Field>
      ))}
      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Plus size={16} className="text-ob-primary" aria-hidden="true" />
          <Select
            aria-label="Add another profile"
            className="w-auto min-w-[220px]"
            options={available.map((p) => ({ value: p, label: SOCIAL_LABELS[p] }))}
            value={null}
            placeholder="Add another profile"
            onValueChange={(p) => setExtra((e) => [...e, p])}
          />
        </div>
      )}
    </div>
  );
}
