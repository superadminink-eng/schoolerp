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
  createDepartmentMasterSchema,
  updateDepartmentMasterSchema,
} from "@/lib/validations/department-master";

interface DepartmentMasterData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
}

interface DepartmentMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: DepartmentMasterData | null;
  onSuccess: () => void;
}

export function DepartmentMasterDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: DepartmentMasterDialogProps) {
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
      const result = createDepartmentMasterSchema.safeParse(formData);
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
        const res = await fetch("/api/v1/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          if (data.error?.code === "ARCHIVED_CONFLICT") {
            setArchiveConflictId(data.error.meta?.duplicateId);
          } else {
            snackbar.show(data.error?.message ?? "Failed to create department", "error");
          }
          return;
        }

        snackbar.show("Department created successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateDepartmentMasterSchema.safeParse(formData);
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
        const res = await fetch(`/api/v1/departments/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update department", "error");
          return;
        }

        snackbar.show("Department updated successfully", "success");
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
      const res = await fetch(`/api/v1/departments/${archiveConflictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Department restored successfully", "success");
        onOpenChange(false);
        onSuccess();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore department", "error");
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
          {mode === "create" ? "Add Department" : "Edit Department"}
        </DialogTitle>

        {archiveConflictId ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-md bg-warning-container/20 p-4 border border-warning">
              <h4 className="text-body-md font-semibold text-warning-on-container">
                Archived Department Exists
              </h4>
              <p className="text-body-sm text-on-surface-variant mt-1">
                A department with this code already exists in your archives. Would you like to restore and reactivate it instead of creating a duplicate?
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
              label="Department Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="e.g. Academic, Administrative, Sports"
              required
            />

            <TextField
              label="Department Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              error={errors.code}
              placeholder="e.g. ACAD, ADMIN, SPORTS"
              helperText="Unique uppercase alphanumeric code"
              disabled={mode === "edit"}
              required
            />

            <TextField
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              placeholder="Brief description of the department's role and functions"
            />

            {mode === "edit" && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <label className="text-body-sm font-medium text-on-surface block">
                    Active Status
                  </label>
                  <span className="text-body-xs text-on-surface-variant">
                    Inactive departments cannot be assigned to new staff
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
                {mode === "create" ? "Create Department" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
