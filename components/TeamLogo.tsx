"use client";

import { useState } from "react";

// A small deterministic hash so the same team always gets the same
// fallback color, without needing to store a color per team.
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = [
    "#ff7a2f",
    "#3fd3a0",
    "#f4c752",
    "#ff5c6c",
    "#7aa2ff",
    "#c77dff",
    "#4fd1c5",
    "#ff9f68",
  ];
  return palette[Math.abs(hash) % palette.length];
}

export default function TeamLogo({
  logo,
  name,
  size = 32,
  className = "",
}: {
  logo?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!logo || failed) {
    return (
      <div
        className={`shrink-0 rounded-full flex items-center justify-center font-display text-background ${className}`}
        style={{
          width: size,
          height: size,
          background: colorFromName(name),
          fontSize: size * 0.5,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    // External ESPN CDN logos (SVGs) — not worth Next/Image's domain
    // config for small avatars.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-surface-2 border border-border object-cover ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
