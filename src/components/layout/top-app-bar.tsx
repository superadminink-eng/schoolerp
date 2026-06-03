"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface TopAppBarProps {
  title: string;
  onMenuClick: () => void;
  trailing?: React.ReactNode;
  className?: string;
}

export function TopAppBar({
  title,
  onMenuClick,
  trailing,
  className,
}: TopAppBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-20 items-center gap-1 bg-surface/95 px-6 lg:px-10 backdrop-blur-sm",
        className
      )}
    >
      {/* Hamburger — hidden on desktop where persistent drawer is visible */}
      <button
        type="button"
        onClick={onMenuClick}
        className="state-layer focus-ring flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant after:bg-on-surface-variant xl:hidden"
        aria-label="Open navigation menu"
      >
        <Icon name="menu" size={24} />
      </button>

      <h1 className="ml-1 flex-1 truncate text-title-lg font-semibold text-on-surface">
        {title}
      </h1>

      {trailing && (
        <div className="flex items-center gap-2">{trailing}</div>
      )}
    </header>
  );
}
