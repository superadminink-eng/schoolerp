"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "elevated" | "filled" | "outlined";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  elevated: "bg-surface-container-low shadow-elevation-1",
  filled: "bg-surface-container-highest",
  outlined: "bg-surface border border-outline-variant",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "elevated", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[16px]",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pt-6 pb-2", className)} {...props}>
    {children}
  </div>
));

CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-4", className)} {...props}>
    {children}
  </div>
));

CardContent.displayName = "CardContent";

export const CardActions = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-end gap-2 px-6 py-4", className)}
    {...props}
  >
    {children}
  </div>
));

CardActions.displayName = "CardActions";
