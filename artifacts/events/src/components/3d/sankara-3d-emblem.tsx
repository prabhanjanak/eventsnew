import React from "react";
import { motion } from "framer-motion";
import ParticleSphere from "@/components/originkit/ui/particlesphere-variant-3";

interface Sankara3DEmblemProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showTagline?: boolean;
  sphereColor?: string;
}

export function Sankara3DEmblem({
  className = "",
  size = "lg",
  showTagline = true,
  sphereColor = "#ffffff", // Pure white particles
}: Sankara3DEmblemProps) {
  const sizeMap = {
    sm: { container: "w-44 h-44", logo: "w-16 h-16", sphereScale: 6 },
    md: { container: "w-56 h-56", logo: "w-20 h-20", sphereScale: 8 },
    lg: { container: "w-72 h-72 sm:w-80 sm:h-80", logo: "w-28 h-28 sm:w-32 sm:h-32", sphereScale: 10 },
    xl: { container: "w-80 h-80 sm:w-96 sm:h-96", logo: "w-36 h-36 sm:w-40 sm:h-40", sphereScale: 12 },
    hero: { container: "w-96 h-96 sm:w-[450px] sm:h-[450px]", logo: "w-44 h-44 sm:w-52 sm:h-52", sphereScale: 14 },
  };

  const s = sizeMap[size];

  return (
    <div className={`relative flex flex-col items-center gap-1 select-none ${className}`}>
      {/* 3D Particle Sphere + Center Logo Container */}
      <div className={`relative ${s.container} flex items-center justify-center overflow-visible`}>
        {/* Originkit 3D WebGL Particle Sphere */}
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <ParticleSphere
            sphereColor={sphereColor}
            particlesCount={3200}
            particleScale={5}
            speed={7}
            scale={s.sphereScale}
            drag={true}
            cursorOn={true}
            clickForce={2}
            stopOnHover={false}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Plain Clean Center Disc (ensures logo is completely clear and unobstructed) */}
        <div className="absolute z-10 w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#0B0B0E]/95 border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center pointer-events-none">
          {/* Subtle White Neon Edge Halo */}
          <motion.div
            animate={{
              opacity: [0.6, 0.9, 0.6],
              scale: [0.98, 1.04, 0.98],
            }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-2 rounded-full bg-white/10 blur-xl pointer-events-none"
          />
        </div>

        {/* Center Sankara Eye Logo with White Neon Edge Glow */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="relative z-20 flex items-center justify-center pointer-events-none p-2"
        >
          {/* White Neon Silhouette Layer */}
          <img
            src="/sankara-eye-logo.png"
            alt=""
            aria-hidden="true"
            className={`absolute ${s.logo} object-contain filter drop-shadow-[0_0_12px_rgba(255,255,255,0.95)] drop-shadow-[0_0_28px_rgba(255,255,255,0.7)] drop-shadow-[0_0_50px_rgba(255,255,255,0.4)] opacity-90 pointer-events-none`}
          />

          {/* Sharp Foreground Logo */}
          <img
            src="/sankara-eye-logo.png"
            alt="Sankara Eye Care Institutions"
            className={`relative z-10 ${s.logo} object-contain drop-shadow-[0_4px_15px_rgba(0,0,0,0.9)]`}
          />
        </motion.div>
      </div>

      {/* Tagline with clean margin below particle sphere */}
      {showTagline && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center z-10 relative mt-2 pt-1"
        >
          <p className="text-[10px] sm:text-[11px] text-zinc-400 font-semibold tracking-widest uppercase">
            Sri Kanchi Kamakoti Medical Trust
          </p>
        </motion.div>
      )}
    </div>
  );
}
