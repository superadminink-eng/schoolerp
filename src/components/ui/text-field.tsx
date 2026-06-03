"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  variant?: "outlined" | "filled";
  error?: string;
  helperText?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onTrailingIconClick?: () => void;
  fullWidth?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      variant = "outlined",
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      onTrailingIconClick,
      fullWidth = false,
      className,
      disabled,
      required,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [internalHasValue, setInternalHasValue] = useState(false);
    
    // Check if the component is controlled and has a value, or has a default value
    const hasValue = 
      (value !== undefined && value !== null && value !== "") || 
      (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") || 
      internalHasValue;

    const isFloating = 
      isFocused || 
      hasValue || 
      !!props.placeholder || 
      props.type === "date" || 
      props.type === "time" || 
      props.type === "datetime-local" || 
      props.type === "month" || 
      props.type === "week";
      
    const hasError = !!error;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setInternalHasValue(!!e.target.value);
      onBlur?.(e);
    };

    const borderColor = hasError
      ? "border-error"
      : isFocused
        ? "border-primary"
        : "border-outline";

    const labelColor = hasError
      ? "text-error"
      : isFocused
        ? "text-primary"
        : "text-on-surface-variant";

    if (variant === "filled") {
      return (
        <div className={cn("relative", fullWidth && "w-full", className)}>
          <div
            className={cn(
              "relative flex items-center",
              "bg-surface-container-highest",
              "rounded-t-[4px]",
              "border-b-2",
              borderColor,
              disabled && "opacity-38"
            )}
          >
            {leadingIcon && (
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant ml-3 shrink-0">
                {leadingIcon}
              </span>
            )}
            <div className="relative flex-1 pt-2">
              <label
                className={cn(
                  "absolute left-4 transition-all duration-200 pointer-events-none",
                  labelColor,
                  isFloating
                    ? "top-1 text-[12px] leading-4"
                    : "top-4 text-[16px] leading-6"
                )}
              >
                {label}
                {required && " *"}
              </label>
              <input
                ref={ref}
                value={value}
                defaultValue={defaultValue}
                disabled={disabled}
                required={required}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full bg-transparent px-4 pt-4 pb-2 text-[16px] leading-6 text-on-surface outline-none disabled:cursor-not-allowed"
                {...props}
              />
            </div>
            {trailingIcon && (
              <button
                type="button"
                onClick={onTrailingIconClick}
                tabIndex={-1}
                className="material-symbols-outlined text-[20px] text-on-surface-variant mr-3 shrink-0 cursor-pointer"
              >
                {trailingIcon}
              </button>
            )}
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

    // Outlined variant (default)
    return (
      <div className={cn("relative", fullWidth && "w-full", className)}>
        <div className={cn("relative flex items-center h-[56px] rounded-[8px]", disabled && "opacity-38")}>
          {/* Fieldset for the border notch */}
          <fieldset
            className={cn(
              "absolute inset-0 m-0 px-2 pointer-events-none",
              "rounded-[8px]",
              borderColor,
              isFocused ? "border-2" : "border"
            )}
            style={{
              paddingLeft: leadingIcon ? "32px" : "8px"
            }}
          >
            <legend
              className={cn(
                "h-0 overflow-hidden text-[12px] leading-[0] transition-all duration-200",
                isFloating ? "max-w-full px-1" : "max-w-0 px-0"
              )}
            >
              <span className="opacity-0">
                {label}
                {required && " *"}
              </span>
            </legend>
          </fieldset>

          {leadingIcon && (
            <span
              className={cn(
                "material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 z-10",
                isFocused ? "ml-[11px]" : "ml-3"
              )}
            >
              {leadingIcon}
            </span>
          )}

          <div className="relative flex-1 h-full flex items-center">
            <label
              className={cn(
                "absolute transition-all duration-200 pointer-events-none z-10",
                labelColor,
                isFloating
                  ? cn(
                      "top-[-9px] text-[12px] leading-4",
                      leadingIcon ? "-left-6" : "left-1"
                    )
                  : cn(
                      "top-1/2 -translate-y-1/2 text-[16px] leading-6",
                      leadingIcon ? "left-2" : "left-4"
                    )
              )}
            >
              {label}
              {required && " *"}
            </label>
            <input
              ref={ref}
              value={value}
              defaultValue={defaultValue}
              disabled={disabled}
              required={required}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={cn(
                "w-full h-full bg-transparent z-10 relative",
                leadingIcon ? "pl-2 pr-4" : "px-4",
                "text-[16px] leading-6 text-on-surface",
                "outline-none",
                "disabled:cursor-not-allowed"
              )}
              {...props}
            />
          </div>

          {trailingIcon && (
            <button
              type="button"
              onClick={onTrailingIconClick}
              tabIndex={-1}
              className={cn(
                "material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 cursor-pointer z-10",
                isFocused ? "mr-[11px]" : "mr-3"
              )}
            >
              {trailingIcon}
            </button>
          )}
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

TextField.displayName = "TextField";
