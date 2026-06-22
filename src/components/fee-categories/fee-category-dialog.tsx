"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSnackbar } from "@/components/ui/snackbar";
import { createFeeCategorySchema } from "@/lib/validations/fee-category";
import { Icon } from "@/components/ui/icon";

type FeeCategoryFormValues = z.infer<typeof createFeeCategorySchema>;

interface FeeCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  initialData?: any;
}

export function FeeCategoryDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  initialData,
}: FeeCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [archiveConflictId, setArchiveConflictId] = useState<string | null>(null);
  const snackbar = useSnackbar();

  const form = useForm<FeeCategoryFormValues>({
    resolver: zodResolver(createFeeCategorySchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        form.reset({
          name: initialData.name,
          code: initialData.code,
          description: initialData.description || "",
          isActive: initialData.isActive,
        });
      } else {
        form.reset({
          name: "",
          code: "",
          description: "",
          isActive: true,
        });
      }
      setArchiveConflictId(null);
    }
  }, [open, mode, initialData, form]);

  const onSubmit = async (values: FeeCategoryFormValues) => {
    try {
      setLoading(true);
      const url =
        mode === "create"
          ? "/api/v1/fee-categories"
          : `/api/v1/fee-categories/${initialData.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          mode === "create" &&
          response.status === 409 &&
          data.error?.code === "ARCHIVED_CONFLICT"
        ) {
          setArchiveConflictId(data.error.meta.duplicateId);
          return;
        }
        throw new Error(data.error?.message || "Something went wrong");
      }

      snackbar.show(
        `Fee Category ${mode === "create" ? "created" : "updated"} successfully`,
        "success"
      );
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      snackbar.show(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!archiveConflictId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/fee-categories/${archiveConflictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      const data = await res.json();
      if (res.ok) {
        snackbar.show("Fee category restored successfully", "success");
        onSuccess();
        onOpenChange(false);
      } else {
        throw new Error(data.error?.message || "Failed to restore");
      }
    } catch (error: any) {
      snackbar.show(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="mb-4">
          <DialogTitle>
            {archiveConflictId
              ? "Restore Archived Category"
              : mode === "create"
              ? "Add New Fee Category"
              : "Edit Fee Category"}
          </DialogTitle>
        </div>
        <div className="p-1">
          {archiveConflictId ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
              <div className="rounded-full bg-orange-100 p-3">
                <Icon name="warning" size={24} className="text-orange-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-title-md font-bold text-on-surface">Category Already Exists</h3>
                <p className="text-body-md text-on-surface-variant">
                  A fee category with this name is currently archived. Creating a duplicate will fragment financial records. Would you like to restore it instead?
                </p>
              </div>
              <div className="flex w-full space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outlined"
                  className="flex-1"
                  onClick={() => setArchiveConflictId(null)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="filled"
                  className="flex-1"
                  onClick={handleRestore}
                  disabled={loading}
                >
                  {loading ? "Restoring..." : "Restore Category"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <TextField
                label="Name"
                placeholder="e.g. Tuition Fee"
                {...form.register("name")}
                error={form.formState.errors.name?.message}
                required
                fullWidth
              />

              <TextField
                label="Code"
                placeholder="e.g. TUITION_FEE"
                className="uppercase"
                {...form.register("code")}
                error={form.formState.errors.code?.message}
                helperText="Must be uppercase alphanumeric, no spaces."
                required
                fullWidth
              />

              <div className="space-y-1 flex flex-col">
                <label className="text-label-sm font-medium text-on-surface">Description</label>
                <textarea
                  className="flex w-full rounded-md border border-outline-variant bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-on-surface-variant/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  placeholder="Optional details..."
                  rows={3}
                  {...form.register("description")}
                />
                {form.formState.errors.description?.message && (
                  <p className="text-body-xs text-error">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="flex flex-row items-center justify-between rounded-xl border border-outline-variant p-4">
                <div className="space-y-0.5">
                  <p className="text-label-lg font-medium text-on-surface">Active Status</p>
                  <p className="text-body-sm text-on-surface-variant">
                    Inactive categories cannot be assigned to new classes.
                  </p>
                </div>
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(val) => form.setValue("isActive", val)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="filled" disabled={loading}>
                  {loading ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
