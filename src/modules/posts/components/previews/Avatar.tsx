"use client";

import { useState } from "react";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img
        src={src}
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={className}
        style={{ width: size, height: size, borderRadius: "9999px", objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        backgroundColor: "#8b8f98",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
