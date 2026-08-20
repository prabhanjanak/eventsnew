import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { Users, Award, Sparkles, MapPin, Calendar } from "lucide-react";

interface EventHeroBannerProps {
  event: any;
  seatsLeft?: number;
  isPaid?: boolean;
  className?: string;
}

export function EventHeroBanner({
  event,
  seatsLeft = 500,
  isPaid = false,
  className = "",
}: EventHeroBannerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Smooth 3D Cursor Parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);

  const glintX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), springConfig);
  const glintY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), springConfig);
  const glintBackground = useMotionTemplate`radial-gradient(circle 320px at ${glintX}% ${glintY}%, rgba(255, 255, 255, 0.25) 0%, transparent 80%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full rounded-3xl cursor-pointer select-none transition-all duration-300 ${className}`}
      style={{ perspective: 1200 }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full min-h-[220px] sm:min-h-[250px] xl:min-h-[270px] rounded-3xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden border border-white/20 shadow-2xl backdrop-blur-xl"
      >
        {/* ── Background Layer 0: Dynamic Mesh Gradient with Rich Holographic Accents ── */}
        <div
          className="absolute inset-0 z-0 transition-transform duration-700 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 85% 15%, rgba(99, 102, 241, 0.45) 0%, transparent 50%),
              radial-gradient(circle at 15% 85%, rgba(168, 85, 247, 0.35) 0%, transparent 55%),
              radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 60%),
              linear-gradient(135deg, #0D0F14 0%, #151821 50%, #0A0C10 100%)
            `,
          }}
        />

        {/* ── Background Layer 1: Futuristic Medical Laser Grid & Geometric Waves ── */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none mix-blend-screen"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="laser-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.75" />
              <circle cx="40" cy="40" r="1.5" fill="rgba(99, 102, 241, 0.8)" />
            </pattern>
            <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#A855F7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#laser-grid)" />
        </svg>

        {/* ── Background Layer 2: 3D Holographic Concentric Optical Ring Watermark ── */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          className="absolute -right-16 -top-16 sm:-right-10 sm:-top-10 w-72 h-72 sm:w-96 sm:h-96 rounded-full border border-indigo-500/20 pointer-events-none z-0"
          style={{ transform: "translateZ(-15px)" }}
        >
          <div className="absolute inset-4 rounded-full border border-dashed border-purple-400/25" />
          <div className="absolute inset-12 rounded-full border border-blue-400/20" />
          <div className="absolute inset-20 rounded-full border border-dashed border-emerald-400/30" />
          <div className="absolute top-1/2 left-0 w-3 h-3 rounded-full bg-indigo-400 blur-[2px] shadow-[0_0_15px_#818CF8]" />
        </motion.div>

        {/* ── Background Layer 3: Interactive Glint Spotlight ── */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300 z-0"
          style={{
            background: glintBackground,
          }}
        />

        {/* ── TOP BADGES ROW (Layer 10) ── */}
        <div
          className="relative z-10 flex items-center justify-between flex-wrap gap-2.5"
          style={{ transform: "translateZ(25px)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Event Category Badge */}
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 backdrop-blur-md text-white border border-white/20 shadow-sm flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-300" />
              <span>{event.eventType ? event.eventType.toUpperCase() : "MEDICAL EVENT"}</span>
            </span>

            {/* Seats Telemetry Pill */}
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 backdrop-blur-md text-blue-300 border border-blue-400/30 shadow-sm flex items-center gap-1.5">
              <Users className="w-3 h-3 text-blue-400" />
              <span>{seatsLeft} Seats Left</span>
            </span>

            {/* Accreditation Badge */}
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 backdrop-blur-md text-emerald-300 border border-emerald-500/30 items-center gap-1">
              <Award className="w-3 h-3 text-emerald-400" />
              <span>Accredited CME</span>
            </span>
          </div>

          {/* Pricing Highlight */}
          <div className="px-4 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-zinc-900/90 to-black/90 backdrop-blur-md text-white border border-white/20 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{isPaid ? `From ₹${event.registrationFee?.toLocaleString("en-IN")}` : "Free Admission"}</span>
          </div>
        </div>

        {/* ── BOTTOM CONTENT & TITLE AREA (Layer 20) ── */}
        <div
          className="relative z-10 space-y-2.5 pt-6"
          style={{ transform: "translateZ(35px)" }}
        >
          {/* Subtitle / Organization */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818CF8]" />
            <p className="text-zinc-300 text-xs sm:text-sm font-semibold tracking-wider uppercase">
              {event.badgeSubtitle || "Sankara Eye Care Institutions • Sri Kanchi Kamakoti Medical Trust"}
            </p>
          </div>

          {/* Glowing 3D Event Title */}
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-300">
              {event.title}
            </span>
          </h2>

          {/* Quick Info Bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-zinc-300 font-medium">
            {event.startDate && (
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>{event.startDate}</span>
              </span>
            )}
            {(event.venue || event.city) && (
              <span className="flex items-center gap-1.5 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{event.venue ? `${event.venue}, ` : ""}{event.city}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
