"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { useSnackbar } from "@/components/ui/snackbar";
import { PermissionGate } from "@/components/shared/permission-gate";
import { DOCUMENT_LABEL_OPTIONS } from "@/lib/validations/staff-document";
import { getUploadUrl } from "@/lib/upload-url";

interface StaffDocument {
  id: string;
  label: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface StaffDocumentsProps {
  staffId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StaffDocuments({ staffId }: StaffDocumentsProps) {
  const snackbar = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/staff/${staffId}/documents`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch {
      snackbar.show("Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [staffId, snackbar]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload() {
    if (!selectedFile || !label) {
      snackbar.show("Please select a file and label", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("label", label);

      const res = await fetch(`/api/v1/staff/${staffId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        snackbar.show(data.error?.message ?? "Failed to upload document", "error");
        return;
      }

      snackbar.show("Document uploaded", "success");
      setLabel("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(
        `/api/v1/staff/${staffId}/documents/${docId}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!data.success) {
        snackbar.show(data.error?.message ?? "Failed to delete document", "error");
        return;
      }

      snackbar.show("Document deleted", "success");
      fetchDocuments();
    } catch {
      snackbar.show("An error occurred", "error");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-title-lg font-semibold text-on-surface">
        Documents
      </h2>

      {/* Upload form */}
      <PermissionGate module="staff" action="update">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-4">
          <h3 className="text-title-sm font-medium text-on-surface">
            Upload Document
          </h3>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1 sm:w-48">
              <label className="text-label-md text-on-surface-variant px-1">
                Label *
              </label>
              <Select value={label} onValueChange={setLabel}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder="Select label" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_LABEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Image *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="text-body-md text-on-surface file:mr-3 file:rounded-full file:border-0 file:bg-primary-container file:px-4 file:py-1.5 file:text-label-md file:font-medium file:text-on-primary-container hover:file:bg-primary/10 file:cursor-pointer"
              />
            </div>

            <Button
              variant="filled"
              icon="upload"
              loading={uploading}
              onClick={handleUpload}
              disabled={!selectedFile || !label}
            >
              Upload
            </Button>
          </div>

          <p className="text-body-sm text-on-surface-variant">
            Accepted: JPEG, PNG, WebP. Maximum size: 2MB.
          </p>
        </div>
      </PermissionGate>

      {/* Document grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-on-surface-variant">
          <span className="material-symbols-outlined text-[36px] animate-spin">
            progress_activity
          </span>
        </div>
      ) : documents.length === 0 ? (
        <p className="text-body-md text-on-surface-variant py-4">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] bg-surface-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getUploadUrl(doc.filePath)}
                  alt={doc.label}
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Chip label={doc.label} variant="outlined" color="primary" />
                  <PermissionGate module="staff" action="update">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-label-sm text-error hover:bg-error/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                      Delete
                    </button>
                  </PermissionGate>
                </div>
                <p className="text-body-sm text-on-surface-variant truncate">
                  {doc.fileName}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  {formatFileSize(doc.fileSize)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
