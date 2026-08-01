"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { getUploadUrl } from "@/lib/upload-url";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    documentType: string;
    fileName?: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    status?: string;
    remarks?: string | null;
  } | null;
  onReplaceClick?: () => void;
  isReplacing?: boolean;
}

export function DocumentPreviewDialog({ open, onOpenChange, document, onReplaceClick, isReplacing }: DocumentPreviewDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!document) return null;

  const url = getUploadUrl(document.filePath);
  const isPdf = document.filePath.toLowerCase().endsWith(".pdf") || document.mimeType === "application/pdf";
  const sizeMb = document.fileSize ? (document.fileSize / 1024 / 1024).toFixed(2) + " MB" : "N/A";

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] h-[85vh] rounded-3xl bg-white dark:bg-zinc-950 p-0 border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden focus:outline-none">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-4 bg-slate-50/60 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-primary shrink-0 shadow-2xs">
              <Icon name={isPdf ? "picture_as_pdf" : "image"} size={20} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                {document.documentType.replace(/_/g, " ")}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                <span>{document.fileName || "Uploaded Document"}</span>
                <span>•</span>
                <span>{sizeMb}</span>
              </DialogDescription>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2 shrink-0">
            {!isPdf && (
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Zoom Out"
                >
                  <Icon name="zoom_out" size={16} />
                </button>
                <span className="text-[11px] font-mono font-bold px-1 text-slate-600 dark:text-zinc-300 min-w-[36px] text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Zoom In"
                >
                  <Icon name="zoom_in" size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Rotate 90°"
                >
                  <Icon name="rotate_right" size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-[10px] font-bold"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>
            )}

            {onReplaceClick && (
              <button
                type="button"
                onClick={onReplaceClick}
                disabled={isReplacing}
                className="p-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-2xs disabled:opacity-50"
                title="Replace Document"
              >
                {isReplacing ? (
                  <Icon name="sync" size={16} className="animate-spin" />
                ) : (
                  <Icon name="upload" size={16} />
                )}
                <span className="hidden sm:inline">{isReplacing ? "Replacing..." : "Replace"}</span>
              </button>
            )}

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Open in new tab"
            >
              <Icon name="open_in_new" size={16} />
              <span className="hidden sm:inline">External View</span>
            </a>
          </div>
        </div>

        {/* Document Viewing Canvas */}
        <div className="flex-1 bg-slate-100/60 dark:bg-zinc-900/60 p-4 overflow-auto flex items-center justify-center relative">
          {isPdf ? (
            <iframe
              src={url}
              className="w-full h-full rounded-2xl border border-slate-200/60 dark:border-zinc-800 bg-white shadow-inner"
              title={document.documentType}
            />
          ) : (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={document.documentType}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-slate-200 dark:border-zinc-800"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
