import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

export interface TactileButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "glow-blue" | "glow-purple" | "glass" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  icon?: React.ReactNode;
  glow?: boolean;
}

export const TactileButton = React.forwardRef<HTMLButtonElement, TactileButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      className = "",
      icon,
      glow = false,
      disabled,
      ...props
    },
    ref
  ) => {
    // Variant Styles
    const variantStyles = {
      primary:
        "bg-white text-zinc-950 hover:bg-zinc-100 border border-white/60 shadow-[0_4px_14px_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)]",
      secondary:
        "bg-[#1C1C20] text-zinc-100 hover:bg-[#25252B] border border-[#323238] shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]",
      "glow-blue":
        "bg-gradient-to-b from-blue-500 to-blue-600 text-white border border-blue-400/50 shadow-[0_4px_20px_rgba(59,130,246,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-blue-400 hover:to-blue-600",
      "glow-purple":
        "bg-gradient-to-b from-purple-500 to-purple-600 text-white border border-purple-400/50 shadow-[0_4px_20px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-purple-400 hover:to-purple-600",
      glass:
        "bg-[#141417]/80 backdrop-blur-xl text-zinc-200 hover:text-white border border-white/10 hover:border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
      danger:
        "bg-gradient-to-b from-red-500 to-red-600 text-white border border-red-400/50 shadow-[0_4px_16px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]",
    };

    // Size Styles
    const sizeStyles = {
      sm: "h-8 px-3.5 text-xs rounded-full gap-1.5 font-semibold",
      md: "h-10 px-4.5 text-xs sm:text-sm rounded-xl gap-2 font-bold",
      lg: "h-12 px-6 text-sm sm:text-base rounded-2xl gap-2.5 font-black",
      xl: "h-14 px-8 text-base sm:text-lg rounded-2xl gap-3 font-black tracking-tight",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.97, y: disabled ? 0 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        disabled={disabled}
        className={`relative inline-flex flex-row items-center justify-center whitespace-nowrap select-none cursor-pointer overflow-hidden transition-colors shrink-0 ${
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        } ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {/* Top Gloss Highlight Edge */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"
          aria-hidden="true"
        />

        {/* Optional Ambient Glow Halo */}
        {glow && (
          <span
            className="pointer-events-none absolute -inset-1 rounded-full opacity-40 blur-md bg-gradient-to-r from-blue-500 to-purple-500"
            aria-hidden="true"
          />
        )}

        {/* Content */}
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);

TactileButton.displayName = "TactileButton";
