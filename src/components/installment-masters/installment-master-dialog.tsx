"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useSnackbar } from "@/components/ui/snackbar";
import {
  createInstallmentMasterSchema,
  updateInstallmentMasterSchema,
} from "@/lib/validations/installment-master";

interface InstallmentMasterData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
}

interface InstallmentMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: InstallmentMasterData | null;
  onSuccess: () => void;
}

export function InstallmentMasterDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: InstallmentMasterDialogProps) {
  const snackbar = useSnackbar();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [archiveConflictId, setArchiveConflictId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setCode(initialData.code);
        setDescription(initialData.description ?? "");
        setIsActive(initialData.isActive ?? true);
      } else {
        setName("");
        setCode("");
        setDescription("");
        setIsActive(true);
      }
      setErrors({});
      setArchiveConflictId(null);
    }
  }, [open, mode, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formData = { name, code, description: description || undefined, isActive };

    if (mode === "create") {
      const result = createInstallmentMasterSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/v1/installment-masters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          if (data.error?.code === "ARCHIVED_CONFLICT") {
            setArchiveConflictId(data.error.meta?.duplicateId);
          } else {
            snackbar.show(data.error?.message ?? "Failed to create installment master", "error");
          }
          return;
        }

        snackbar.show("Installment master created successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateInstallmentMasterSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/v1/installment-masters/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update installment master", "error");
          return;
        }

        snackbar.show("Installment master updated successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleRestoreArchived() {
    if (!archiveConflictId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/installment-masters/${archiveConflictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true, deletedAt: null }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Installment master restored successfully", "success");
        onOpenChange(false);
        onSuccess();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore installment master", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          {archiveConflictId ? "Master Already Exists" : (mode === "create" ? "Add Installment Master" : "Edit Installment Master")}
        </DialogTitle>
        
        {archiveConflictId ? (
          <div className="mt-4 space-y-6">
            <div className="bg-primary-container/30 text-on-surface p-4 rounded-lg border border-primary/20">
              <p className="text-body-md font-medium mb-2">
                An installment master named &quot;{name}&quot; is currently Archived in your system.
              </p>
              <p className="text-body-sm text-on-surface-variant">
                Creating a new master with the same name will fragment your historical records. Would you like to restore the existing master instead?
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="text" onClick={() => setArchiveConflictId(null)} disabled={loading}>
                Back
              </Button>
              <Button type="button" variant="filled" onClick={handleRestoreArchived} loading={loading}>
                Restore Master
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. Term 1 Fee"
            required
            fullWidth
          />
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={errors.code}
            placeholder="e.g. TERM_1"
            required
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            placeholder="Optional description"
            fullWidth
          />
          {mode === "edit" && (
            <div className="flex items-center justify-between rounded-lg border border-outline-variant p-3">
              <div>
                <p className="text-label-lg font-medium text-on-surface">Status: {isActive ? "Active" : "Archived"}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {isActive ? "Master is available for new classes." : "Master is hidden from new classes."}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="text">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="filled" loading={loading}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
