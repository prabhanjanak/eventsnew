import React from "react";
import { PerspectiveCard } from "./perspective-card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPIMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon: LucideIcon;
  color?: "blue" | "purple" | "emerald" | "amber" | "rose";
  className?: string;
}

export function KPIMetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = "blue",
  className = "",
}: KPIMetricCardProps) {
  const colorMap = {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      iconText: "text-blue-400",
      glow: "from-blue-500/20 to-transparent",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      iconText: "text-purple-400",
      glow: "from-purple-500/20 to-transparent",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      iconText: "text-emerald-400",
      glow: "from-emerald-500/20 to-transparent",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      iconText: "text-amber-400",
      glow: "from-amber-500/20 to-transparent",
    },
    rose: {
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      iconText: "text-rose-400",
      glow: "from-rose-500/20 to-transparent",
    },
  };

  const scheme = colorMap[color];

  return (
    <PerspectiveCard
      depth={8}
      className={`bg-[#141417]/90 backdrop-blur-xl border border-[#2B2B32] p-5 sm:p-6 ${className}`}
    >
      {/* Background Ambient Glow Corner */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br ${scheme.glow} blur-2xl`}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4">
        {/* Header: Title & 3D Floating Icon */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {title}
          </span>
          <div
            className={`w-10 h-10 rounded-2xl ${scheme.bg} ${scheme.border} border flex items-center justify-center shadow-lg`}
            style={{ transform: "translateZ(15px)" }}
          >
            <Icon className={`w-5 h-5 ${scheme.iconText}`} />
          </div>
        </div>

        {/* Value */}
        <div className="space-y-1">
          <div
            className="text-2xl sm:text-4xl font-black text-white tracking-tight"
            style={{ transform: "translateZ(20px)" }}
          >
            {value}
          </div>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            {trend.isPositive ? (
              <span className="flex items-center font-bold text-emerald-400 gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {trend.value}
              </span>
            ) : (
              <span className="flex items-center font-bold text-rose-400 gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" />
                {trend.value}
              </span>
            )}
            <span className="text-zinc-500 text-[11px]">vs previous cycle</span>
          </div>
        )}
      </div>
    </PerspectiveCard>
  );
}
