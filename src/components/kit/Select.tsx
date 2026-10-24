"use client";

import { useMemo, useRef } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { option, popup, trigger } from "@/components/kit/styles";
import { SearchBox, NoMatches } from "@/components/kit/dropdown-parts";

export interface DropdownOption {
  value: string;
  label: string;
  /** Small muted text on the right, e.g. a country code */
  hint?: string;
}

interface SelectProps {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  /** Adds a search box inside the dropdown, for long lists */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Sizes the trigger, e.g. "w-24" */
  className?: string;
  "aria-label"?: string;
}

/** Single-choice dropdown. Searchable for long lists such as timezones. */
export function Select(props: SelectProps) {
  return props.searchable ? <SearchSelect {...props} /> : <PlainSelect {...props} />;
}

function OptionRow({ item, Indicator }: { item: DropdownOption; Indicator: typeof BaseSelect.ItemIndicator | typeof Combobox.ItemIndicator }) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.hint && <span className="text-xs text-ob-faint">{item.hint}</span>}
      <Indicator className="text-ob-primary">
        <Check size={15} strokeWidth={2.5} />
      </Indicator>
    </>
  );
}

function PlainSelect({ id, value, onValueChange, options, placeholder = "Select…", className, ...rest }: SelectProps) {
  return (
    <BaseSelect.Root items={options} value={value} onValueChange={(v) => v != null && onValueChange(v as string)}>
      <BaseSelect.Trigger id={id} aria-label={rest["aria-label"]} className={cn(trigger, className)}>
        <BaseSelect.Value placeholder={placeholder} className="min-w-0 truncate data-[placeholder]:text-ob-faint" />
        <BaseSelect.Icon className="shrink-0 text-ob-muted">
          <ChevronDown size={16} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
          <BaseSelect.Popup className={popup}>
            <BaseSelect.List className="overflow-y-auto p-1.5">
              {options.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} className={option}>
                  <OptionRow item={o} Indicator={BaseSelect.ItemIndicator} />
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function SearchSelect({ id, value, onValueChange, options, placeholder = "Select…", searchPlaceholder = "Search…", className, ...rest }: SelectProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(o: DropdownOption | null) => o && onValueChange(o.value)}
      itemToStringLabel={(o: DropdownOption) => o.label}
      isItemEqualToValue={(a: DropdownOption, b: DropdownOption) => a.value === b.value}
      autoHighlight
    >
      <Combobox.Trigger ref={anchorRef} id={id} aria-label={rest["aria-label"]} className={cn(trigger, className)}>
        <span className={cn("min-w-0 truncate", !selected && "text-ob-faint")}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-ob-muted" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchorRef} sideOffset={6} className="z-50 outline-none">
          <Combobox.Popup className={popup}>
            <SearchBox placeholder={searchPlaceholder} />
            <NoMatches />
            <Combobox.List className="overflow-y-auto p-1.5">
              {(o: DropdownOption) => (
                <Combobox.Item key={o.value} value={o} className={option}>
                  <OptionRow item={o} Indicator={Combobox.ItemIndicator} />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
