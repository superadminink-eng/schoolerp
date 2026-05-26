"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useSnackbar } from "@/components/ui/snackbar";
import {
  createSubjectMasterSchema,
  updateSubjectMasterSchema,
} from "@/lib/validations/subject-master";

interface SubjectMasterData {
  id: string;
  name: string;
  code: string;
  type: string;
  description?: string | null;
  isActive: boolean;
}

interface SubjectMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: SubjectMasterData | null;
  onSuccess: () => void;
}

export function SubjectMasterDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: SubjectMasterDialogProps) {
  const snackbar = useSnackbar();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("THEORY");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setCode(initialData.code);
        setType(initialData.type);
        setDescription(initialData.description ?? "");
      } else {
        setName("");
        setCode("");
        setType("THEORY");
        setDescription("");
      }
      setErrors({});
    }
  }, [open, mode, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formData = { name, code, type, description: description || undefined };

    if (mode === "create") {
      const result = createSubjectMasterSchema.safeParse(formData);
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
        const res = await fetch("/api/v1/subject-masters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create subject", "error");
          return;
        }

        snackbar.show("Subject created successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateSubjectMasterSchema.safeParse(formData);
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
        const res = await fetch(`/api/v1/subject-masters/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update subject", "error");
          return;
        }

        snackbar.show("Subject updated successfully", "success");
        onOpenChange(false);
        onSuccess();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          {mode === "create" ? "Add Subject" : "Edit Subject"}
        </DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. Mathematics"
            required
            fullWidth
          />
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={errors.code}
            placeholder="e.g. MATH"
            required
            fullWidth
          />
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface-variant px-1">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger fullWidth>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THEORY">Theory</SelectItem>
                <SelectItem value="PRACTICAL">Practical</SelectItem>
                <SelectItem value="ELECTIVE">Elective</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            placeholder="Optional description"
            fullWidth
          />
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
      </DialogContent>
    </Dialog>
  );
}
