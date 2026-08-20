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
  sphereColor = "#38BDF8", // Sankara Medical Cyan / Blue
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

        {/* Ambient Core Glow */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.35, 0.18, 0.35],
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute w-36 h-36 rounded-full bg-cyan-500/25 blur-2xl pointer-events-none z-10"
        />

        {/* Center Sankara Eye Logo */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="relative z-20 flex items-center justify-center pointer-events-none p-3 rounded-full bg-black/40 backdrop-blur-sm border border-cyan-400/20 shadow-[0_0_30px_rgba(6,182,212,0.35)]"
        >
          <img
            src="/sankara-eye-logo.png"
            alt="Sankara Eye Care Institutions"
            className={`${s.logo} object-contain filter drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]`}
          />
        </motion.div>
      </div>

      {/* Tagline */}
      {showTagline && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center space-y-0.5 z-10 relative -mt-4"
        >
          <p className="text-[11px] sm:text-xs font-bold text-zinc-300 tracking-wider uppercase">
            Sankara Eye Care Institutions
          </p>
          <p className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">
            Sri Kanchi Kamakoti Medical Trust
          </p>
        </motion.div>
      )}
    </div>
  );
}
