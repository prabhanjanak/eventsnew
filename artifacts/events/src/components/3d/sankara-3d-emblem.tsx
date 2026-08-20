import React from "react";
import { InteractiveSankaraEye } from "./interactive-sankara-eye";

export { InteractiveSankaraEye };

interface Sankara3DEmblemProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showTagline?: boolean;
  interactive?: boolean;
}

export function Sankara3DEmblem({
  className = "",
  size = "lg",
  showTagline = true,
  interactive = true,
}: Sankara3DEmblemProps) {
  return (
    <InteractiveSankaraEye
      className={className}
      size={size}
      showTagline={showTagline}
      interactive={interactive}
    />
  );
}
