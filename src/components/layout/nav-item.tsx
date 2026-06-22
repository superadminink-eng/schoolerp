"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { NavItemType } from "@/config/permissions";

interface NavItemProps {
  item: NavItemType;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({ item, collapsed = false, onClick }: NavItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const hasChildren = item.children && item.children.length > 0;

  // Check if this item or any of its children are active
  const isActive = hasChildren
    ? item.children!.some(
        (child) => child.href && (pathname === child.href || pathname.startsWith(child.href + "/"))
      )
    : item.href
      ? pathname === item.href || pathname.startsWith(item.href + "/")
      : false;

  const content = (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 w-full",
        !hasChildren && "hover:scale-[1.02]",
        isActive && !hasChildren
          ? "bg-primary text-on-primary shadow-md shadow-primary/20"
          : isActive && hasChildren
          ? "text-primary"
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
          !isActive && !hasChildren && "group-hover:scale-110",
          isActive && !hasChildren ? "text-white" : isActive && hasChildren ? "text-primary" : "text-slate-400 group-hover:text-primary"
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate tracking-wide flex-1 text-left">{item.label}</span>
          {hasChildren && (
            <Icon
              name="expand_more"
              size={18}
              className={cn(
                "transition-transform duration-300 text-slate-400 group-hover:text-primary",
                isOpen ? "rotate-180" : ""
              )}
            />
          )}
        </>
      )}
    </div>
  );

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          className="w-full focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          {content}
        </button>
        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            isOpen && !collapsed ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden flex flex-col gap-1 pl-9 pr-2">
            {item.children!.map((child) => (
              <NavItem key={child.label} item={child} onClick={onClick} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={item.href || "#"} onClick={onClick} className="block w-full focus:outline-none">
      {content}
    </Link>
  );
}
