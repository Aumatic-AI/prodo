"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { button } from "@/components/kit/styles";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 font-ob">
      <div className="flex max-w-[440px] flex-col items-center gap-5 text-center animate-in fade-in zoom-in-95 duration-300">
        <span className="grid size-16 place-items-center rounded-full bg-ob-danger-soft text-ob-danger ring-8 ring-ob-danger-soft/50">
          <TriangleAlert size={28} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">This page hit a problem</h1>
          <p className="m-0 text-[15px] text-ob-muted">{error.message || "Something went wrong while loading it."} Your work is saved; try again.</p>
          {error.digest && <p className="m-0 font-mono text-xs text-ob-faint">Reference: {error.digest}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button type="button" className={button()} onClick={reset}>
            <RotateCcw size={16} /> Try again
          </button>
          <Link href="/week" className={button({ variant: "secondary" })}>
            Go to This week
          </Link>
        </div>
      </div>
    </div>
  );
}
