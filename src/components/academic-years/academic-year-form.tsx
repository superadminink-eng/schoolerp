"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useSnackbar } from "@/components/ui/snackbar";
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} from "@/lib/validations/academic-year";

interface AcademicYearData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface AcademicYearFormProps {
  mode: "create" | "edit";
  initialData?: AcademicYearData;
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function AcademicYearForm({ mode, initialData }: AcademicYearFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [name, setName] = useState(initialData?.name ?? "");
  const [startDate, setStartDate] = useState(
    formatDateForInput(initialData?.startDate)
  );
  const [endDate, setEndDate] = useState(
    formatDateForInput(initialData?.endDate)
  );
  const [isCurrent, setIsCurrent] = useState(initialData?.isCurrent ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formFields = { name, startDate, endDate, isCurrent };

    if (mode === "create") {
      const result = createAcademicYearSchema.safeParse(formFields);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/v1/academic-years", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create academic year", "error");
          return;
        }

        snackbar.show("Academic year created successfully", "success");
        router.push("/academic-years");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateAcademicYearSchema.safeParse(formFields);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/v1/academic-years/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update academic year", "error");
          return;
        }

        snackbar.show("Academic year updated successfully", "success");
        router.push("/academic-years");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl">
      <Card variant="outlined">
        <CardContent className="p-6 space-y-5">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. 2024-25"
            required
            fullWidth
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={errors.startDate}
              required
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={errors.endDate}
              required
              fullWidth
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isCurrent}
              onCheckedChange={setIsCurrent}
            />
            <label className="text-body-md text-on-surface">
              Set as current academic year
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/academic-years")}
        >
          Cancel
        </Button>
        <Button type="submit" variant="filled" loading={loading} icon="save">
          {mode === "create" ? "Create Academic Year" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
