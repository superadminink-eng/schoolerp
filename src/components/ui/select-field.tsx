"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface SelectFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  labelBg?: string;
  variant?: "outlined" | "compact";
}

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(
  (
    {
      label,
      value,
      onValueChange,
      options,
      placeholder = "Select option",
      error,
      helperText,
      disabled,
      required,
      fullWidth = false,
      className,
      labelBg = "bg-transparent",
      variant = "outlined",
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasValue = value !== undefined && value !== null && value !== "" && value !== "__none__";
    const isFloating = isOpen || hasValue;
    const hasError = !!error;

    const borderColor = hasError
      ? "border-error"
      : isOpen
        ? "border-primary"
        : "border-outline hover:border-primary/50";

    const labelColor = hasError
      ? "text-error"
      : isOpen
        ? "text-primary"
        : "text-on-surface-variant";

    if (variant === "compact") {
      return (
        <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full", className)}>
          <span
            className={cn(
              "text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 px-0.5 select-none",
              disabled && "opacity-50"
            )}
          >
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </span>
          <div
            className={cn(
              "relative flex items-center h-10 rounded-lg border bg-white dark:bg-slate-900 transition-all duration-200",
              isOpen
                ? "border-primary ring-4 ring-primary/10"
                : hasError
                  ? "border-error focus-within:ring-2 focus-within:ring-error/20 focus-within:border-error"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
              disabled && "bg-slate-50 dark:bg-slate-950 opacity-50 cursor-not-allowed"
            )}
          >
            <label className="sr-only">
              {label}
              {required && " *"}
            </label>
            <Select
              value={value}
              onValueChange={onValueChange}
              disabled={disabled}
              onOpenChange={setIsOpen}
            >
              <SelectTrigger
                ref={ref}
                variant="unstyled"
                fullWidth
                className="w-full h-full px-3 text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between"
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(error || helperText) && (
            <p
              className={cn(
                "mt-0.5 px-0.5 text-[11px] leading-4",
                hasError ? "text-error" : "text-slate-400"
              )}
            >
              {error || helperText}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className={cn("relative", fullWidth && "w-full", className)}>
        <div className={cn("relative flex items-center h-12 rounded-[8px]", disabled && "opacity-38")}>
          {/* Fieldset for the border notch */}
          <fieldset
            className={cn(
              "absolute inset-0 m-0 px-2 pointer-events-none",
              "rounded-[8px]",
              borderColor,
              isOpen ? "border-2" : "border"
            )}
            style={{
              paddingLeft: "0px"
            }}
          >
            <legend
              className={cn(
                "float-none overflow-hidden text-[12px] leading-none transition-all duration-200",
                isFloating ? "max-w-full px-1.5 h-3" : "max-w-[0.01px] px-0 h-0"
              )}
            >
              <span className="opacity-0">
                {label}
                {required && " *"}
              </span>
            </legend>
          </fieldset>

          <div className="relative flex-1 h-full flex items-center">
            <label
              className={cn(
                "absolute transition-all duration-200 pointer-events-none z-10 whitespace-nowrap truncate",
                labelColor,
                isFloating
                  ? cn("top-[-9px] text-[12px] leading-4 left-1 px-1 max-w-[calc(100%-12px)]", labelBg)
                  : "top-1/2 -translate-y-1/2 text-[16px] leading-6 max-w-[calc(100%-24px)] left-4"
              )}
            >
              {label}
              {required && " *"}
            </label>

            <Select
              value={value}
              onValueChange={onValueChange}
              disabled={disabled}
              onOpenChange={setIsOpen}
            >
              <SelectTrigger
                ref={ref}
                variant="unstyled"
                fullWidth
                className={cn(
                  "px-4 pt-3 pb-1 text-[16px] leading-6 text-on-surface flex items-center justify-between",
                  isOpen ? "data-[placeholder]:text-on-surface-variant/50" : "data-[placeholder]:text-transparent"
                )}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(error || helperText) && (
          <p
            className={cn(
              "mt-1 px-4 text-[12px] leading-4",
              hasError ? "text-error" : "text-on-surface-variant"
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

SelectField.displayName = "SelectField";
