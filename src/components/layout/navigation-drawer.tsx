"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Icon } from "@/components/ui/icon";
import { NavItem } from "./nav-item";
import type { NavItemData } from "./nav-item";
import { cn } from "@/lib/utils";

interface DrawerContentProps {
  items: NavItemData[];
  orgName: string;
  onItemClick?: () => void;
  className?: string;
}

function DrawerContent({
  items,
  orgName,
  onItemClick,
  className,
}: DrawerContentProps) {
  return (
    <div
      className={cn(
        "flex h-full w-[280px] flex-col bg-slate-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-1 px-6 py-8 border-b border-slate-200/60 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-md shadow-primary/20">
            <Icon name="school" size={22} />
          </div>
          <div className="flex flex-col">
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
      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        <div className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest px-2 mb-3">Main Menu</div>
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.href}>
              <NavItem item={item} onClick={onItemClick} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/* ─── Standard (persistent) drawer ─── */

interface StandardDrawerProps {
  items: NavItemData[];
  orgName: string;
  className?: string;
}

export function StandardDrawer({
  items,
  orgName,
  className,
}: StandardDrawerProps) {
  return (
    <aside
      className={cn(
        "border-r border-outline-variant",
        className
      )}
    >
      <DrawerContent items={items} orgName={orgName} />
    </aside>
  );
}

/* ─── Modal drawer (mobile / tablet) ─── */

interface ModalDrawerProps {
  items: NavItemData[];
  orgName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalDrawer({
  items,
  orgName,
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
            onItemClick={() => onOpenChange(false)}
            className="rounded-r-lg"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
