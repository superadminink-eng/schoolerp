"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  HTMLDivElement,
  DialogPrimitive.DialogContentProps & { overlayClassName?: string }
>(({ className, children, overlayClassName, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-scrim/30 backdrop-blur-sm",
        "data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide",
        overlayClassName
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2",
        "rounded-2xl bg-surface-container-lowest p-7 border border-outline-variant/60 shadow-elevation-4",
        "data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide",
        "focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1.5 text-on-surface-variant/70 hover:bg-slate-100 hover:text-on-surface transition-all duration-200 cursor-pointer">
        <Icon name="close" size={18} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  DialogPrimitive.DialogTitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-headline-sm font-semibold text-on-surface", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  DialogPrimitive.DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("mt-2 text-body-md text-on-surface-variant", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
