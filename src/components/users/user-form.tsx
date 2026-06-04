"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useSnackbar } from "@/components/ui/snackbar";
import { useBranches } from "@/hooks/use-branches";
import { useRoles } from "@/hooks/use-roles";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";



interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string };
  isActive: boolean;
  branch: { id: string; name: string } | null;
}

const roleLabel = (name: string) =>
  name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

interface UserFormProps {
  mode: "create" | "edit";
  initialData?: UserData;
}

export function UserForm({ mode, initialData }: UserFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { branches, isLoading: branchesLoading } = useBranches();
  const { roles, loading: rolesLoading } = useRoles();

  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [roleId, setRoleId] = useState(initialData?.role?.id ?? "");
  const [branchId, setBranchId] = useState(initialData?.branch?.id ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "create") {
      const result = createUserSchema.safeParse({
        name,
        email,
        phone: phone || undefined,
        roleId,
        branchId,
        password,
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
        const res = await fetch("/api/v1/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create user", "error");
          return;
        }

        snackbar.show("User created successfully", "success");
        router.push("/users");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateUserSchema.safeParse({
        name,
        phone: phone || undefined,
        roleId: roleId || undefined,
        branchId: branchId || undefined,
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
        const res = await fetch(`/api/v1/users/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update user", "error");
          return;
        }

        snackbar.show("User updated successfully", "success");
        router.push("/users");
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
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leadingIcon="person"
              error={errors.name}
              required
              fullWidth
              autoComplete="name"
            />
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
          </div>

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leadingIcon="mail"
            error={errors.email}
            required
            fullWidth
            autoComplete="email"
            disabled={mode === "edit"}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Role *
              </label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder={rolesLoading ? "Loading…" : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {roleLabel(r.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="px-4 text-[12px] leading-4 text-error">{errors.roleId}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Branch *
              </label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder={branchesLoading ? "Loading…" : "Select a branch"} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branchId && (
                <p className="px-4 text-[12px] leading-4 text-error">{errors.branchId}</p>
              )}
            </div>
          </div>

          {mode === "create" && (
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leadingIcon="lock"
              trailingIcon={showPassword ? "visibility_off" : "visibility"}
              onTrailingIconClick={() => setShowPassword(!showPassword)}
              error={errors.password}
              required
              fullWidth
              autoComplete="new-password"
            />
          )}

          {mode === "edit" && (
            <div className="flex items-center justify-between px-1">
              <label htmlFor="user-active" className="text-body-md text-on-surface cursor-pointer">
                Active
              </label>
              <Switch
                id="user-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/users")}
        >
          Cancel
        </Button>
        <Button type="submit" variant="filled" loading={loading} icon="save">
          {mode === "create" ? "Create User" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
