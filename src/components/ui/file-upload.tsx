"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { getUploadUrl } from "@/lib/upload-url";

interface FileUploadProps {
  accept?: string;
  onChange: (file: File | null) => void;
  value: File | null;
  label?: string;
  preview?: string | null;
  className?: string;
}

export function FileUpload({
  accept,
  onChange,
  value,
  label = "Upload file",
  preview,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = value
    ? URL.createObjectURL(value)
    : preview ? getUploadUrl(preview) : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-label-md text-on-surface-variant px-1">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-outline-variant p-6",
          "cursor-pointer transition-colors hover:bg-surface-container-high hover:border-outline",
          "focus-ring"
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="h-16 w-16 rounded-sm object-cover"
          />
        ) : (
          <Icon name="cloud_upload" size={32} className="text-on-surface-variant" />
        )}
        <span className="text-body-sm text-on-surface-variant">
          {value ? value.name : "Click to select a file"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-body-sm text-error hover:underline self-start px-1 cursor-pointer"
        >
          Remove
        </button>
      )}
    </div>
  );
}
