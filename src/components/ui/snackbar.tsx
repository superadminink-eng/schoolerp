"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";

type SnackbarVariant = "default" | "success" | "error" | "warning" | "info";

interface SnackbarMessage {
  id: string;
  text: string;
  variant: SnackbarVariant;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface SnackbarContextType {
  show: (
    text: string,
    variant?: SnackbarVariant,
    options?: { action?: SnackbarMessage["action"]; duration?: number }
  ) => void;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}

const variantStyles: Record<SnackbarVariant, string> = {
  default: "bg-inverse-surface text-inverse-on-surface",
  success: "bg-success-bg text-success-text",
  error: "bg-error-bg text-error-text",
  warning: "bg-warning-bg text-warning-text",
  info: "bg-info-bg text-info-text",
};

const variantActionStyles: Record<SnackbarVariant, string> = {
  default: "text-inverse-primary hover:bg-inverse-primary/8",
  success: "text-success-icon hover:bg-success-icon/8",
  error: "text-error-icon hover:bg-error-icon/8",
  warning: "text-warning-icon hover:bg-warning-icon/8",
  info: "text-info-icon hover:bg-info-icon/8",
};

const variantIconColors: Record<SnackbarVariant, string> = {
  default: "text-inverse-on-surface",
  success: "text-success-icon",
  error: "text-error-icon",
  warning: "text-warning-icon",
  info: "text-info-icon",
};

function SnackbarIcon({ variant }: { variant: SnackbarVariant }) {
  const className = cn("size-5 shrink-0", variantIconColors[variant]);

  switch (variant) {
    case "success":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "error":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      );
    case "warning":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    default:
      return null;
  }
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([]);

  const show = useCallback(
    (
      text: string,
      variant: SnackbarVariant = "default",
      options?: { action?: SnackbarMessage["action"]; duration?: number }
    ) => {
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev, { id, text, variant, ...options }]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto z-50 flex flex-col gap-2">
        {messages.map((msg) => (
          <SnackbarItem key={msg.id} message={msg} onDismiss={dismiss} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

function SnackbarItem({
  message,
  onDismiss,
}: {
  message: SnackbarMessage;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const variant = message.variant;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(message.id), 200);
    }, message.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 min-w-[288px] max-w-[560px]",
        variantStyles[variant],
        "rounded-sm shadow-elevation-3",
        "text-body-md transition-all duration-200",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <SnackbarIcon variant={variant} />
      <span className="flex-1">{message.text}</span>
      {message.action && (
        <button
          onClick={message.action.onClick}
          className={cn(
            "text-label-lg font-medium px-2 py-1 rounded-xs cursor-pointer",
            variantActionStyles[variant]
          )}
        >
          {message.action.label}
        </button>
      )}
    </div>
  );
}
