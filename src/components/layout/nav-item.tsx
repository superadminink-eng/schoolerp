"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface NavItemData {
  label: string;
  href: string;
  icon: string;
}

interface NavItemProps {
  item: NavItemData;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({ item, collapsed = false, onClick }: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300",
        "overflow-hidden hover:scale-[1.02]",
        isActive
          ? "bg-primary text-on-primary shadow-md shadow-primary/20"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-0 rounded-xl w-11 h-11 mx-auto"
      )}
    >
      <Icon
        name={item.icon}
        size={20}
        filled={isActive}
        className={cn(
          "shrink-0 transition-transform duration-300",
          !isActive && "group-hover:scale-110",
          isActive ? "text-white" : "text-slate-400 group-hover:text-primary"
        )}
      />
      {!collapsed && <span className="truncate tracking-wide">{item.label}</span>}
    </Link>
  );
}
