"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Caption text clipped to a few lines with a "more" toggle, like the real feeds. Hashtags and mentions are highlighted. */
export function Caption({ text, prefix, lines = 3, linkClass = "text-sky-700" }: { text: string; prefix?: string; lines?: 2 | 3 | 4; linkClass?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 60 || text.split("\n").length > lines;
  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" }[lines];

  return (
    <div>
      <p className={cn("m-0 whitespace-pre-wrap break-words", !open && clamp)}>
        {prefix && <span className="mr-1.5 font-semibold">{prefix}</span>}
        {text.split(/(\s+)/).map((part, i) =>
          /^[#@]\w/.test(part) ? (
            <span key={i} className={linkClass}>
              {part}
            </span>
          ) : (
            part
          )
        )}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-0.5 text-[13px] text-neutral-500 hover:underline">
          {open ? "less" : "more"}
        </button>
      )}
    </div>
  );
}
