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
}

function DrawerContent({
  items,
  orgName,
  orgLogo,
  onItemClick,
  className,
}: DrawerContentProps) {
  const logoUrl = orgLogo ? getUploadUrl(orgLogo) : null;

  return (
    <div
      className={cn(
        "flex h-full w-[280px] flex-col bg-slate-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-20 items-center px-6 border-b border-slate-200/60 bg-white">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${orgName} Logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-on-primary shadow-md shadow-primary/20">
                <Icon name="school" size={22} />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
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
            <li key={item.label}>
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
        "border-r border-outline-variant",
        className
      )}
    >
      <DrawerContent items={items} orgName={orgName} orgLogo={orgLogo} />
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
