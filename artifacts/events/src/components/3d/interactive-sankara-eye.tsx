import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles } from "lucide-react";

interface InteractiveSankaraEyeProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showTagline?: boolean;
  showParticles?: boolean;
  showRipples?: boolean;
  interactive?: boolean;
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  angle: number;
  orbitRadius: number;
  speed: number;
  color: string;
  alpha: number;
  vx: number;
  vy: number;
}

interface Shockwave {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const PARTICLE_COLORS = [
  "rgba(56, 189, 248, ",   // Sky blue
  "rgba(99, 102, 241, ",   // Indigo
  "rgba(6, 182, 212, ",    // Cyan
  "rgba(16, 185, 129, ",   // Emerald
  "rgba(168, 85, 247, ",   // Purple
];

export function InteractiveSankaraEye({
  className = "",
  size = "lg",
  showTagline = true,
  showParticles = true,
  showRipples = true,
  interactive = true,
}: InteractiveSankaraEyeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);

  // 3D Tilt Spring Physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 180, mass: 0.6 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [18, -18]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-18, 18]), springConfig);

  // Pupil / Iris Eye Gaze Tracking
  const gazeX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { damping: 15, stiffness: 220 });
  const gazeY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-6, 6]), { damping: 15, stiffness: 220 });

  const sizeMap = {
    sm: { container: "w-28 h-28", logo: "w-16 h-16", canvas: 160, particleCount: 40 },
    md: { container: "w-36 h-36", logo: "w-22 h-22", canvas: 200, particleCount: 65 },
    lg: { container: "w-48 h-48 sm:w-56 sm:h-56", logo: "w-32 h-32 sm:w-36 sm:h-36", canvas: 280, particleCount: 90 },
    xl: { container: "w-60 h-60 sm:w-72 sm:h-72", logo: "w-40 h-40 sm:w-48 sm:h-48", canvas: 360, particleCount: 130 },
    hero: { container: "w-72 h-72 sm:w-96 sm:h-96", logo: "w-48 h-48 sm:w-64 sm:h-64", canvas: 450, particleCount: 180 },
  };

  const s = sizeMap[size];

  // Mouse & Gaze coordinate tracking relative to container center
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !interactive) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }, [interactive, mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Click Shockwave Burst
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !showRipples) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newWave: Shockwave = {
      id: Date.now() + Math.random(),
      x: clickX,
      y: clickY,
      radius: 5,
      maxRadius: s.canvas * 0.8,
      alpha: 1,
    };
    setShockwaves((prev) => [...prev.slice(-3), newWave]);
  }, [showRipples, s.canvas]);

  // HTML5 Canvas Particle Engine
  useEffect(() => {
    if (!showParticles) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = s.canvas;
    const height = s.canvas;
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize particles along eye contours & orbits
    const particles: Particle[] = [];
    for (let i = 0; i < s.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / s.particleCount + Math.random() * 0.2;
      // Elliptical eye-shaped distribution
      const orbitR = (width * 0.25) + (Math.random() * width * 0.22);
      const x = centerX + Math.cos(angle) * orbitR * 1.25;
      const y = centerY + Math.sin(angle) * orbitR * 0.85;

      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        radius: Math.random() * 2 + 1,
        angle,
        orbitRadius: orbitR,
        speed: (Math.random() * 0.008 + 0.003) * (i % 2 === 0 ? 1 : -1),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        alpha: Math.random() * 0.6 + 0.3,
        vx: 0,
        vy: 0,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Render & Update Particles
      particles.forEach((p) => {
        p.angle += p.speed;

        // Orbital Motion
        const targetX = centerX + Math.cos(p.angle + time * 0.2) * p.orbitRadius * 1.2;
        const targetY = centerY + Math.sin(p.angle + time * 0.2) * p.orbitRadius * 0.8;

        // Spring toward target orbit
        p.x += (targetX - p.x) * 0.05 + p.vx;
        p.y += (targetY - p.y) * 0.05 + p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;

        // Draw glowing particle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.shadowColor = p.color + "0.8)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      // Draw dynamic subtle energy connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < width * 0.16) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const lineAlpha = (1 - dist / (width * 0.16)) * 0.15;
            ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [showParticles, s.canvas, s.particleCount]);

  // Shockwave Animation Tick
  useEffect(() => {
    if (shockwaves.length === 0) return;
    const interval = setInterval(() => {
      setShockwaves((prev) =>
        prev
          .map((w) => ({
            ...w,
            radius: w.radius + 6,
            alpha: Math.max(0, w.alpha - 0.04),
          }))
          .filter((w) => w.alpha > 0)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [shockwaves]);

  return (
    <div className={`relative flex flex-col items-center gap-3 ${className}`}>
      {/* 3D Perspective Card Container */}
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative ${s.container} flex items-center justify-center cursor-pointer select-none`}
      >
        {/* Background Ambient Glow Halo */}
        <motion.div
          animate={{
            scale: isHovered ? [1.1, 1.25, 1.1] : [1, 1.15, 1],
            opacity: isHovered ? 0.45 : [0.25, 0.15, 0.25],
          }}
          transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/30 via-indigo-500/25 to-emerald-400/25 blur-3xl pointer-events-none"
        />

        {/* Orbiting Laser Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="absolute inset-[-6%] rounded-full border border-dashed border-cyan-400/20 pointer-events-none"
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22D3EE]" />
        </motion.div>

        {/* Reverse Orbital Counter-Ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
          className="absolute inset-[-12%] rounded-full border border-dotted border-indigo-400/15 pointer-events-none"
        >
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818CF8]" />
        </motion.div>

        {/* HTML5 Particle Orbit Canvas */}
        {showParticles && (
          <canvas
            ref={canvasRef}
            style={{ width: s.canvas, height: s.canvas }}
            className="absolute pointer-events-none z-0"
          />
        )}

        {/* Frosted Lens Glass Disc */}
        <div
          style={{ transform: "translateZ(10px)" }}
          className="absolute inset-[10%] rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-md border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden"
        >
          {/* Specular Light Flare Sweep */}
          <motion.div
            animate={{
              x: ["-150%", "150%"],
            }}
            transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", repeatDelay: 2 }}
            className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
          />

          {/* Shockwave Rings on Click */}
          {shockwaves.map((w) => (
            <div
              key={w.id}
              style={{
                left: `${w.x}px`,
                top: `${w.y}px`,
                width: `${w.radius * 2}px`,
                height: `${w.radius * 2}px`,
                opacity: w.alpha,
                transform: "translate(-50%, -50%)",
              }}
              className="absolute rounded-full border-2 border-cyan-400 pointer-events-none shadow-[0_0_15px_#22D3EE]"
            />
          ))}
        </div>

        {/* 👁️ Interactive Logo & Gaze Pupil Layer */}
        <motion.div
          style={{
            x: gazeX,
            y: gazeY,
            transform: "translateZ(30px)",
          }}
          className="relative z-10 flex items-center justify-center"
        >
          <img
            src="/sankara-eye-logo.png"
            alt="Sankara Eye Care Institutions"
            className={`${s.logo} object-contain filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)] transition-transform duration-200 group-hover:scale-105`}
          />
        </motion.div>

        {/* Interactive Hover Hint Badge */}
        {interactive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
            style={{ transform: "translateZ(40px)" }}
            className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-indigo-500/90 text-white text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 pointer-events-none"
          >
            <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
            <span>Interactive Eye</span>
          </motion.div>
        )}
      </motion.div>

      {/* Optional Tagline */}
      {showTagline && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center space-y-0.5"
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
