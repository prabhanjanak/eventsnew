import React, { useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface PerspectiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glareEffect?: boolean;
  depth?: number;
  elevateOnHover?: boolean;
}

export function PerspectiveCard({
  children,
  className = "",
  glareEffect = true,
  depth = 12,
  elevateOnHover = true,
  ...props
}: PerspectiveCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for smooth 60fps spring physics
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 260, mass: 0.6 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [depth, -depth]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-depth, depth]), springConfig);
  const scale = useSpring(isHovered && elevateOnHover ? 1.015 : 1, springConfig);

  // Glare position
  const glareX = useSpring(useTransform(x, [-0.5, 0.5], ["0%", "100%"]), springConfig);
  const glareY = useSpring(useTransform(y, [-0.5, 0.5], ["0%", "100%"]), springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const xPct = mouseX / width - 0.5;
      const yPct = mouseY / height - 0.5;

      x.set(xPct);
      y.set(yPct);
    },
    [x, y]
  );

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={`relative transition-shadow duration-300 ${
        isHovered
          ? "shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(59,130,246,0.12)]"
          : "shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
      } ${className}`}
      {...(props as any)}
    >
      {/* 3D Card Content Layer */}
      <div
        className="w-full h-full overflow-hidden"
        style={{ transform: "translateZ(10px)" }}
      >
        {children}
      </div>

      {/* Dynamic Specular Light Glare */}
      {glareEffect && (
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 z-30"
          style={{
            opacity: isHovered ? 0.35 : 0,
            background: `radial-gradient(circle 350px at ${glareX} ${glareY}, rgba(255,255,255,0.2), transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}
