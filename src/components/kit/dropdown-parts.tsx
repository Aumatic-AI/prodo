"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Search } from "lucide-react";

/** Search field at the top of a searchable dropdown. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-ob-line px-3">
      <Search size={15} className="shrink-0 text-ob-muted" aria-hidden="true" />
      <Combobox.Input
        placeholder={placeholder}
        className="h-11 w-full border-0 bg-transparent text-sm text-ob-ink outline-none placeholder:text-ob-faint"
      />
    </div>
  );
}

export function NoMatches() {
  return <Combobox.Empty className="px-3 py-6 text-center text-sm text-ob-muted empty:hidden">No matches</Combobox.Empty>;
}
