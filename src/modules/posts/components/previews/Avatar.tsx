"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

/** Account picture, or the first letter on a soft background when there's none (or it fails to load). */
export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src && !errored) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" onError={() => setErrored(true)} className={cn("shrink-0 rounded-full object-cover", className)} style={style} />;
  }
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-ob-primary-soft font-bold text-ob-primary", className)} style={style} aria-hidden="true">
      {initial}
    </span>
  );
}
