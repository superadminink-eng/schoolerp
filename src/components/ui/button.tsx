"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type ButtonVariant = "filled" | "outlined" | "text" | "tonal" | "elevated";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: "leading" | "trailing";
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  filled: [
    "bg-primary text-on-primary shadow-sm shadow-primary/20",
    "hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm",
    "disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:transform-none",
  ].join(" "),
  outlined: [
    "border-2 border-slate-200 text-slate-700 bg-white",
    "hover:border-primary hover:text-primary hover:bg-slate-50",
    "active:bg-slate-100",
    "disabled:border-slate-100 disabled:text-slate-400 disabled:bg-slate-50",
  ].join(" "),
  text: [
    "text-slate-600 bg-transparent",
    "hover:bg-slate-100 hover:text-slate-900",
    "active:bg-slate-200",
    "disabled:text-slate-400 disabled:bg-transparent",
  ].join(" "),
  tonal: [
    "bg-primary-container text-on-primary-container",
    "hover:bg-primary-container/85 hover:text-on-primary-container",
    "active:bg-primary-container/70",
    "disabled:bg-slate-50 disabled:text-slate-400",
  ].join(" "),
  elevated: [
    "bg-white text-primary shadow-md shadow-slate-200 border border-slate-100",
    "hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-200",
    "active:translate-y-0 active:shadow-sm",
    "disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:border-transparent",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs font-bold gap-2 rounded-xl",
  md: "h-11 px-6 text-sm font-bold gap-2 rounded-xl",
  lg: "h-12 px-8 text-base font-bold gap-3 rounded-2xl",
};

const iconOnlySizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "filled",
      size = "md",
      icon,
      iconPosition = "leading",
      fullWidth = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isIconOnly = icon && !children;
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-sans tracking-wide transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:pointer-events-none",
          "overflow-hidden",
          // Variant
          variantStyles[variant],
          // Size
          isIconOnly ? iconOnlySizeStyles[size] : sizeStyles[size],
          // Full width
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && (
          <span className="material-symbols-outlined text-[18px] animate-spin">
            progress_activity
          </span>
        )}
        {!loading && icon && iconPosition === "leading" && (
          <Icon name={icon} size={size === "sm" ? 16 : size === "md" ? 18 : 20} className="shrink-0" />
        )}
        {children}
        {!loading && icon && iconPosition === "trailing" && (
          <Icon name={icon} size={size === "sm" ? 16 : size === "md" ? 18 : 20} className="shrink-0" />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
