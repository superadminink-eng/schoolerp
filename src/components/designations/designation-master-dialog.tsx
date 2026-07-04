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
  createDesignationMasterSchema,
  updateDesignationMasterSchema,
} from "@/lib/validations/designation-master";

interface DesignationMasterData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
}

interface DesignationMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: DesignationMasterData | null;
  onSuccess: () => void;
}

export function DesignationMasterDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: DesignationMasterDialogProps) {
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
      const result = createDesignationMasterSchema.safeParse(formData);
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
        const res = await fetch("/api/v1/designations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          if (data.error?.code === "ARCHIVED_CONFLICT") {
            setArchiveConflictId(data.error.meta?.duplicateId);
          } else {
            snackbar.show(data.error?.message ?? "Failed to create designation", "error");
          }
          return;
        }

        snackbar.show("Designation created successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateDesignationMasterSchema.safeParse(formData);
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
        const res = await fetch(`/api/v1/designations/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update designation", "error");
          return;
        }

        snackbar.show("Designation updated successfully", "success");
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
      const res = await fetch(`/api/v1/designations/${archiveConflictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Designation restored successfully", "success");
        onOpenChange(false);
        onSuccess();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore designation", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>
          {mode === "create" ? "Add Designation" : "Edit Designation"}
        </DialogTitle>

        {archiveConflictId ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-md bg-warning-container/20 p-4 border border-warning">
              <h4 className="text-body-md font-semibold text-warning-on-container">
                Archived Designation Exists
              </h4>
              <p className="text-body-sm text-on-surface-variant mt-1">
                A designation with this code already exists in your archives. Would you like to restore and reactivate it instead of creating a duplicate?
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <Button
                variant="text"
                type="button"
                onClick={() => setArchiveConflictId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                type="button"
                onClick={handleRestoreArchived}
                loading={loading}
              >
                Restore & Reactivate
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <TextField
              label="Designation Title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="e.g. Vice Principal, HOD Science, Senior Teacher"
              required
            />

            <TextField
              label="Designation Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              error={errors.code}
              placeholder="e.g. VP, HOD_SCI, SR_TR"
              helperText="Unique uppercase alphanumeric code"
              disabled={mode === "edit"}
              required
            />

            <TextField
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              placeholder="Brief summary of job responsibilities and authority"
            />

            {mode === "edit" && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <label className="text-body-sm font-medium text-on-surface block">
                    Active Status
                  </label>
                  <span className="text-body-xs text-on-surface-variant">
                    Inactive designations cannot be selected for staff members
                  </span>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <DialogClose asChild>
                <Button variant="text" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="filled" type="submit" loading={loading}>
                {mode === "create" ? "Create Designation" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
