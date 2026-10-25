"use client";

import { useMemo, useRef } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { numberBadge, option, popup, trigger } from "@/components/kit/styles";
import { NoMatches, SearchBox } from "@/components/kit/dropdown-parts";
import type { DropdownOption } from "@/components/kit/Select";

interface MultiSelectProps {
  id?: string;
  /** Selected values, in the order they were picked */
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  max?: number;
  "aria-label"?: string;
}

/** Keeps earlier picks in place and adds new ones at the end, so order means priority. */
function keepOrder(current: string[], next: string[]): string[] {
  const nextSet = new Set(next);
  const kept = current.filter((v) => nextSet.has(v));
  const added = next.filter((v) => !current.includes(v));
  return [...kept, ...added];
}

/** Searchable multi-select. Picks show below as numbered pills; #1 is the top priority. */
export function MultiSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  max = Infinity,
  ...rest
}: MultiSelectProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const selected = value.map((v) => byValue.get(v)).filter((o): o is DropdownOption => !!o);
  const full = value.length >= max;

  return (
    <div className="flex flex-col gap-3">
      <Combobox.Root
        multiple
        items={options}
        value={selected}
        onValueChange={(next: DropdownOption[]) => onChange(keepOrder(value, next.map((o) => o.value)).slice(0, max))}
        itemToStringLabel={(o: DropdownOption) => o.label}
        isItemEqualToValue={(a: DropdownOption, b: DropdownOption) => a.value === b.value}
        autoHighlight
      >
        <Combobox.Trigger ref={anchorRef} id={id} aria-label={rest["aria-label"]} className={trigger}>
          <span className={cn("min-w-0 truncate", !selected.length && "text-ob-faint")}>
            {selected.length ? `${selected.length} selected` : placeholder}
          </span>
          <ChevronDown size={16} className="shrink-0 text-ob-muted" />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner anchor={anchorRef} sideOffset={6} className="z-50 outline-none">
            <Combobox.Popup className={popup}>
              <SearchBox placeholder={searchPlaceholder} />
              <NoMatches />
              <Combobox.List className="overflow-y-auto p-1.5">
                {(o: DropdownOption) => {
                  const position = value.indexOf(o.value);
                  return (
                    <Combobox.Item
                      key={o.value}
                      value={o}
                      disabled={full && position < 0}
                      className={cn(option, "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45")}
                    >
                      <span
                        className={cn(
                          "grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-ob-on-primary",
                          position >= 0 ? "border-ob-primary bg-ob-primary" : "border-ob-line-strong"
                        )}
                        aria-hidden="true"
                      >
                        {position >= 0 && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {position >= 0 ? (
                        <span className="text-xs font-semibold text-ob-primary">#{position + 1}</span>
                      ) : (
                        o.hint && <span className="text-xs text-ob-faint">{o.hint}</span>
                      )}
                    </Combobox.Item>
                  );
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {selected.length > 0 && (
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Selected, in priority order">
          {selected.map((o, i) => (
            <li
              key={o.value}
              className="inline-flex items-center gap-2 rounded-full border border-ob-primary/30 bg-ob-primary-soft py-1 pl-1.5 pr-1.5 text-sm font-semibold text-ob-primary-ink"
            >
              <span className={cn(numberBadge, "size-[22px] bg-ob-surface")}>{i + 1}</span>
              {o.label}
              <button
                type="button"
                aria-label={`Remove ${o.label}`}
                onClick={() => onChange(value.filter((v) => v !== o.value))}
                className="grid size-[22px] place-items-center rounded-full hover:bg-ob-primary/15"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
