"use client";

import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Icon } from "./icon";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: "primary" | "secondary" | "tertiary";
  className?: string;
}

const colorMap = {
  primary: {
    bg: "bg-primary-container",
    text: "text-on-primary-container",
  },
  secondary: {
    bg: "bg-secondary-container",
    text: "text-on-secondary-container",
  },
  tertiary: {
    bg: "bg-tertiary-container",
    text: "text-on-tertiary-container",
  },
};

export function StatsCard({
  title,
  value,
  icon,
  color = "primary",
  className,
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <Card variant="outlined" className={cn("p-6 flex flex-col gap-4 hover:border-primary/50 transition-colors", className)}>
      <div className="flex items-center justify-between">
        <p className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wider">{title}</p>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            colors.bg
          )}
        >
          <Icon name={icon} size={20} className={colors.text} />
        </div>
      </div>
      <div>
        <p className="text-display-sm font-bold text-on-surface tracking-tight">
          {value}
        </p>
      </div>
    </Card>
  );
}
