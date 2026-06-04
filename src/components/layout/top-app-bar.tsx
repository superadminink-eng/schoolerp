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
        "sticky top-0 z-30 flex h-20 items-center gap-2 bg-white/70 px-6 lg:px-8 backdrop-blur-xl border-b border-slate-200/60 transition-all",
        className
      )}
    >
      {/* Hamburger — hidden on desktop where persistent drawer is visible */}
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 xl:hidden transition-colors"
        aria-label="Open navigation menu"
      >
        <Icon name="menu" size={24} />
      </button>

      <div className="ml-1 flex-1 flex items-center gap-3 overflow-hidden">
        <h1 className="truncate text-xl font-black text-slate-900 tracking-tight">
          {title}
        </h1>
      </div>

      {trailing && (
        <div className="flex items-center gap-3">{trailing}</div>
      )}
    </header>
  );
}
