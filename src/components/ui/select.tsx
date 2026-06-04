"use client";

import { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/* ─── Root ─────────────────────────────────────────────────── */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

/* ─── Trigger ──────────────────────────────────────────────── */

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  SelectPrimitive.SelectTriggerProps & { fullWidth?: boolean }
>(({ className, children, fullWidth, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-between gap-2",
      "h-11 rounded-xl px-4",
      "border-2 border-slate-200 bg-white text-slate-700 text-sm font-medium transition-all duration-300",
      "hover:border-primary/50 hover:bg-slate-50",
      "focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary",
      "data-[placeholder]:text-slate-400",
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50",
      fullWidth && "w-full",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <Icon name="expand_more" size={18} className="text-slate-400 shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

/* ─── Content ──────────────────────────────────────────────── */

export const SelectContent = forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectContentProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50",
        "animate-in fade-in-80 zoom-in-95 duration-200",
        "min-w-[var(--radix-select-trigger-width)]",
        className
      )}
      position="popper"
      sideOffset={8}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1.5">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

/* ─── Item ─────────────────────────────────────────────────── */

export const SelectItem = forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer items-center gap-2 transition-colors",
      "rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 outline-none",
      "focus:bg-primary-container focus:text-on-primary-container",
      "data-[highlighted]:bg-primary-container data-[highlighted]:text-on-primary-container",
      "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ml-auto">
      <Icon name="check" size={16} className="text-primary font-bold" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
