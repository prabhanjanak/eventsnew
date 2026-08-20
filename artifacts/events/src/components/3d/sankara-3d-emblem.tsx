import React from "react";
import { motion } from "framer-motion";

interface Sankara3DEmblemProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
}

export function Sankara3DEmblem({
  className = "",
  size = "lg",
  showTagline = true,
}: Sankara3DEmblemProps) {
  const sizeMap = {
    sm: { container: "w-28 h-28", logo: "w-16 h-16" },
    md: { container: "w-36 h-36", logo: "w-24 h-24" },
    lg: { container: "w-44 h-44 sm:w-52 sm:h-52", logo: "w-28 h-28 sm:w-36 sm:h-36" },
    xl: { container: "w-56 h-56 sm:w-64 sm:h-64", logo: "w-40 h-40 sm:w-48 sm:h-48" },
  };

  const s = sizeMap[size];

  return (
    <div className={`relative flex flex-col items-center gap-4 ${className}`}>
      {/* Emblem Container */}
      <div className={`relative ${s.container} flex items-center justify-center`}>
        {/* Pulsing ambient glow ring */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.15, 0.3],
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-purple-500/30 blur-2xl pointer-events-none"
        />

        {/* Secondary pulse ring (delayed) */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.15, 0.08, 0.15],
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1.5 }}
          className="absolute inset-[-10%] rounded-full bg-gradient-to-tr from-cyan-400/20 to-purple-400/20 blur-3xl pointer-events-none"
        />

        {/* Subtle dashed orbit ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          className="absolute inset-[-4%] rounded-full border border-dashed border-white/[0.08] pointer-events-none"
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400/60" />
        </motion.div>

        {/* Frosted glass circle behind logo */}
        <div className="absolute inset-[12%] rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" />

        {/* Logo with gentle float */}
        <motion.img
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          src="/sankara-eye-logo.png"
          alt="Sankara Eye Care Institutions"
          className={`relative z-10 ${s.logo} object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)]`}
        />
      </div>

      {/* Optional tagline */}
      {showTagline && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-[11px] sm:text-xs text-zinc-500 font-medium tracking-widest uppercase text-center"
        >
          Sri Kanchi Kamakoti Medical Trust
        </motion.p>
      )}
    </div>
  );
}
