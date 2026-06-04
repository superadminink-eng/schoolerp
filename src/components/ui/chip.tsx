"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type ChipVariant = "filled" | "outlined";
type ChipColor = "default" | "primary" | "success" | "error" | "warning";

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  color?: ChipColor;
  icon?: string;
  className?: string;
}

const textColors: Record<ChipColor, string> = {
  default: "text-slate-600 dark:text-slate-300",
  primary: "text-teal-700 dark:text-teal-300",
  success: "text-emerald-700 dark:text-emerald-300",
  error: "text-rose-700 dark:text-rose-300",
  warning: "text-amber-700 dark:text-amber-300",
};

const borderColors: Record<ChipColor, string> = {
  default: "border-slate-200/60 dark:border-slate-800",
  primary: "border-teal-500/10 dark:border-teal-500/20",
  success: "border-emerald-500/10 dark:border-emerald-500/20",
  error: "border-rose-500/10 dark:border-rose-500/20",
  warning: "border-amber-500/10 dark:border-amber-500/20",
};

const bgColors: Record<ChipColor, string> = {
  default: "bg-slate-50 dark:bg-slate-900/30",
  primary: "bg-teal-500/5 dark:bg-teal-500/10",
  success: "bg-emerald-500/5 dark:bg-emerald-500/10",
  error: "bg-rose-500/5 dark:bg-rose-500/10",
  warning: "bg-amber-500/5 dark:bg-amber-500/10",
};

const indicatorDotColors: Record<ChipColor, string> = {
  default: "bg-slate-400",
  primary: "bg-teal-500 shadow-[0_0_6px_rgba(15,118,110,0.4)]",
  success: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)] animate-pulse",
  error: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]",
  warning: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
};

export function Chip({
  label,
  variant = "filled",
  color = "default",
  icon,
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0 border text-[11px] font-bold tracking-wide uppercase whitespace-nowrap transition-all self-center my-auto leading-none",
        variant === "filled" ? bgColors[color] : "bg-transparent",
        borderColors[color],
        textColors[color],
        className
      )}
      style={{ height: "22px", lineHeight: "1", alignSelf: "center" }}
    >
      {icon ? (
        <Icon name={icon} size={12} className="shrink-0 opacity-80" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", indicatorDotColors[color])} />
      )}
      {label}
    </span>
  );
}
