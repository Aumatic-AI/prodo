"use client";

import { useEffect, useMemo } from "react";
import { closestFont, GOOGLE_FONTS, listedFont } from "@/config/google-fonts";
import { Select, type DropdownOption } from "@/components/kit/Select";
import { button } from "@/components/kit/styles";

// Font names in the list and the preview line are drawn in their own font. Google serves a
// stylesheet per request; the browser only downloads a font file once some text uses it.
const SAMPLE = "The quick brown fox jumps over the lazy dog 1234";
const GROUP = 20;
const added = new Set<string>();

function addStylesheet(href: string) {
  if (added.has(href)) return;
  added.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const familyParam = (family: string) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}`;

/** Each family's name only (a tiny subset), in groups so one bad name can't break the rest. */
function loadNames() {
  for (let i = 0; i < GOOGLE_FONTS.length; i += GROUP) {
    const group = GOOGLE_FONTS.slice(i, i + GROUP);
    const letters = [...new Set(group.map((f) => f.family).join(""))].join("");
    addStylesheet(`https://fonts.googleapis.com/css2?${group.map((f) => familyParam(f.family)).join("&")}&text=${encodeURIComponent(letters)}&display=swap`);
  }
}

const OPTIONS: DropdownOption[] = GOOGLE_FONTS.map((f) => ({ value: f.family, label: f.family, hint: f.category, font: f.family }));

interface FontSelectProps {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  role: "heading" | "body";
  placeholder?: string;
}

/**
 * A Google Font for the brand, with a preview line. A font we can't use in ads (e.g. a paid
 * font from the website) is shown with the closest free match to switch to.
 */
export function FontSelect({ id, value, onChange, role, placeholder = "Pick a font" }: FontSelectProps) {
  const listed = listedFont(value);
  const unusable = !!value && !listed;
  const suggestion = unusable ? closestFont(value, role) : null;

  useEffect(loadNames, []);
  useEffect(() => {
    if (listed) addStylesheet(`https://fonts.googleapis.com/css2?${familyParam(listed)}&display=swap`);
  }, [listed]);

  // A font that isn't in the list still shows as the current value
  const options = useMemo(
    () => (unusable ? [{ value: value!, label: value!, hint: "Can't be used in ads" }, ...OPTIONS] : OPTIONS),
    [unusable, value]
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Select id={id} searchable options={options} value={listed ?? value} placeholder={placeholder} searchPlaceholder="Search fonts…" onValueChange={onChange} />
      {listed && (
        <span className="truncate rounded-ob bg-ob-sunken px-3 py-2 text-lg text-ob-ink" style={{ fontFamily: `"${listed}", var(--font-ob)` }}>
          {SAMPLE}
        </span>
      )}
      {unusable && suggestion && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ob-warn">
          {value} isn&apos;t a free font, so ads can&apos;t use it.
          <button type="button" className={button({ variant: "ghost", size: "xs" })} onClick={() => onChange(suggestion)}>
            Use {suggestion}, the closest match
          </button>
        </span>
      )}
    </div>
  );
}
