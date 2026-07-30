"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Icon } from "@/components/ui/icon";
import { NavItem } from "./nav-item";
import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/upload-url";
import type { NavItemType } from "@/config/permissions";

interface DrawerContentProps {
  items: NavItemType[];
  orgName: string;
  orgLogo?: string | null;
  onItemClick?: () => void;
  className?: string;
  isSmart?: boolean;
}

function DrawerContent({
  items,
  orgName,
  orgLogo,
  onItemClick,
  className,
  isSmart = false,
}: DrawerContentProps) {
  const logoUrl = orgLogo ? getUploadUrl(orgLogo) : null;

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-slate-50 transition-all duration-300 ease-in-out",
        isSmart ? "w-[280px]" : "w-[280px]", // fixed width inner content to prevent layout shifts during clip
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-20 items-center px-4 border-b border-slate-200/60 bg-white min-w-[280px]"
      )}>
        <div className="flex items-center w-full">
          {/* Logo Wrapper - Fixed 48px width to perfectly center the 40px logo in the 80px sidebar (16px padding) */}
          <div className="flex w-[48px] shrink-0 items-center justify-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${orgName} Logo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-on-primary shadow-md shadow-primary/20">
                  <span className="text-[15px] font-black">{orgName.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={cn(
            "flex flex-col min-w-0 transition-opacity duration-300 ml-3",
            isSmart ? "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto 2xl:opacity-100 2xl:w-auto" : "opacity-100 w-auto"
          )}>
            <span className="truncate text-[15px] font-black text-slate-900 leading-tight tracking-tight">
              {orgName}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary mt-0.5">
              ERP Portal
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-thin min-w-[280px]">
        <div className={cn(
          "text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-3 whitespace-nowrap transition-opacity duration-300",
          isSmart ? "opacity-0 group-hover/sidebar:opacity-100 2xl:opacity-100" : ""
        )}>
          Main Menu
        </div>
        <ul className="flex flex-col gap-1.5 w-[248px]">
          {items.map((item) => (
            <li key={item.label}>
              <NavItem item={item} onClick={onItemClick} isSmart={isSmart} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/* ─── Standard (persistent) drawer ─── */

interface StandardDrawerProps {
  items: NavItemType[];
  orgName: string;
  orgLogo?: string | null;
  className?: string;
}

export function StandardDrawer({
  items,
  orgName,
  orgLogo,
  className,
}: StandardDrawerProps) {
  return (
    <aside
      className={cn(
        "group/sidebar relative z-40 h-full hidden md:block shrink-0 transition-all duration-300 ease-in-out",
        "w-[80px] 2xl:w-[280px]",
        className
      )}
    >
      <div className={cn(
        "absolute top-0 left-0 h-full bg-slate-50 border-r border-slate-200 overflow-hidden transition-all duration-300 ease-in-out flex flex-col",
        "w-[80px] group-hover/sidebar:w-[280px] 2xl:w-[280px]",
        "group-hover/sidebar:shadow-[4px_0_24px_rgba(0,0,0,0.05)] 2xl:group-hover/sidebar:shadow-none"
      )}>
        <DrawerContent items={items} orgName={orgName} orgLogo={orgLogo} isSmart={true} />
      </div>
    </aside>
  );
}

/* ─── Modal drawer (mobile / tablet) ─── */

interface ModalDrawerProps {
  items: NavItemType[];
  orgName: string;
  orgLogo?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalDrawer({
  items,
  orgName,
  orgLogo,
  open,
  onOpenChange,
}: ModalDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim/32 data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 w-[280px] shadow-elevation-3 data-[state=open]:animate-drawer-show data-[state=closed]:animate-drawer-hide"
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Navigation menu</Dialog.Title>
          </VisuallyHidden.Root>
          <DrawerContent
            items={items}
            orgName={orgName}
            orgLogo={orgLogo}
            onItemClick={() => onOpenChange(false)}
            className="rounded-r-lg"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
