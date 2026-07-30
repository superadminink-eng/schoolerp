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
  isSmart?: boolean;
}

export function NavItem({ item, collapsed = false, onClick, isSmart = false }: NavItemProps) {
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
        "group relative flex items-center rounded-xl py-2 text-sm font-bold transition-all duration-300 w-full overflow-hidden whitespace-nowrap",
        !hasChildren && "hover:scale-[1.02]",
        // Active state handling
        isActive && !hasChildren
          ? "bg-primary text-on-primary shadow-md shadow-primary/20"
          : isActive && hasChildren
          ? "bg-primary/10 text-primary" // Active parent gets light bg so it's visible when collapsed
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-0 rounded-xl w-11 h-11 mx-auto"
      )}
    >
      {/* Icon Wrapper: Fixed 48px width perfectly centers the 24px icon in the 80px sidebar (16px outer padding) */}
      <div className="flex w-[48px] shrink-0 items-center justify-center">
        <Icon
          name={item.icon}
          size={22}
          filled={isActive}
          className={cn(
            "transition-transform duration-300",
            !isActive && !hasChildren && "group-hover:scale-110",
            isActive && !hasChildren ? "text-white" : isActive && hasChildren ? "text-primary" : "text-slate-400 group-hover:text-primary"
          )}
        />
      </div>

      {!collapsed && (
        <div className={cn(
          "flex flex-1 items-center justify-between transition-all duration-300 overflow-hidden pr-4",
          isSmart ? "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto 2xl:opacity-100 2xl:w-auto" : "opacity-100 w-auto"
        )}>
          <span className="truncate tracking-wide flex-1 text-left">{item.label}</span>
          {hasChildren && (
            <Icon
              name="expand_more"
              size={18}
              className={cn(
                "transition-transform duration-300 text-slate-400 group-hover:text-primary shrink-0 ml-2",
                isOpen ? "rotate-180" : ""
              )}
            />
          )}
        </div>
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
          <div className={cn(
            "overflow-hidden flex flex-col gap-1 pl-[48px] pr-0 transition-all duration-300",
            isSmart ? "opacity-0 group-hover/sidebar:opacity-100 2xl:opacity-100" : "opacity-100"
          )}>
            {item.children!.map((child) => (
              <NavItem key={child.label} item={child} onClick={onClick} isSmart={isSmart} />
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
