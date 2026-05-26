"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useSnackbar } from "@/components/ui/snackbar";
import {
  createBranchSchema,
  updateBranchSchema,
} from "@/lib/validations/branch";

interface BranchData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isMain: boolean;
  isActive: boolean;
}

interface BranchFormProps {
  mode: "create" | "edit";
  initialData?: BranchData;
}

export function BranchForm({ mode, initialData }: BranchFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [name, setName] = useState(initialData?.name ?? "");
  const [code, setCode] = useState(initialData?.code ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "create") {
      const result = createBranchSchema.safeParse({
        name,
        code,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });

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
        const res = await fetch("/api/v1/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create branch", "error");
          return;
        }

        snackbar.show("Branch created successfully", "success");
        router.push("/branches");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateBranchSchema.safeParse({
        name,
        code,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        isActive,
      });

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
        const res = await fetch(`/api/v1/branches/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update branch", "error");
          return;
        }

        snackbar.show("Branch updated successfully", "success");
        router.push("/branches");
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Branch Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leadingIcon="location_city"
              error={errors.name}
              required
              fullWidth
            />
            <TextField
              label="Branch Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              leadingIcon="tag"
              error={errors.code}
              required
              fullWidth
              disabled={mode === "edit" && initialData?.isMain}
            />
          </div>

          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            leadingIcon="home"
            error={errors.address}
            fullWidth
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leadingIcon="phone"
              error={errors.phone}
              fullWidth
              autoComplete="tel"
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leadingIcon="mail"
              error={errors.email}
              fullWidth
              autoComplete="email"
            />
          </div>

          {mode === "edit" && (
            <>
              {initialData?.isMain && (
                <div className="flex items-center gap-2 px-1 text-body-md text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">
                    star
                  </span>
                  This is the main branch
                </div>
              )}

              {!initialData?.isMain && (
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="branch-active" className="text-body-md text-on-surface cursor-pointer">
                    Active
                  </label>
                  <Switch
                    id="branch-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/branches")}
        >
          Cancel
        </Button>
        <Button type="submit" variant="filled" loading={loading} icon="save">
          {mode === "create" ? "Create Branch" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
