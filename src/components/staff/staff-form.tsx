"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { useSnackbar } from "@/components/ui/snackbar";
import { useBranches } from "@/hooks/use-branches";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";

const ROLES = [
  { value: "TEACHER", label: "Teacher" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "TRANSPORT_MANAGER", label: "Transport Manager" },
] as const;

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
] as const;

interface StaffData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  qualification: string | null;
  joinDate: string;
  status: string;
  branch: { id: string; name: string };
}

interface StaffFormProps {
  mode: "create" | "edit";
  initialData?: StaffData;
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function StaffForm({ mode, initialData }: StaffFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const { branches, isLoading: branchesLoading } = useBranches();

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [role, setRole] = useState(initialData?.role ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(formatDateForInput(initialData?.dateOfBirth));
  const [gender, setGender] = useState(initialData?.gender ?? "");
  const [qualification, setQualification] = useState(initialData?.qualification ?? "");
  const [joinDate, setJoinDate] = useState(formatDateForInput(initialData?.joinDate));
  const [branchId, setBranchId] = useState(initialData?.branch?.id ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "ACTIVE");

  // Auto-assign branch for non-SUPER_ADMIN users
  useEffect(() => {
    if (!isSuperAdmin && session?.user?.branchId && !branchId) {
      setBranchId(session.user.branchId);
    }
  }, [isSuperAdmin, session?.user?.branchId, branchId]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "create") {
      const result = createStaffSchema.safeParse({
        name,
        email: email || undefined,
        phone: phone || undefined,
        role,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        qualification: qualification || undefined,
        joinDate: joinDate || undefined,
        branchId,
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
        const res = await fetch("/api/v1/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create staff member", "error");
          return;
        }

        snackbar.show("Staff member created successfully", "success");
        router.push("/staff");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateStaffSchema.safeParse({
        name,
        email: email || undefined,
        phone: phone || undefined,
        role: role || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        qualification: qualification || undefined,
        joinDate: joinDate || undefined,
        branchId: branchId || undefined,
        status,
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
        const res = await fetch(`/api/v1/staff/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update staff member", "error");
          return;
        }

        snackbar.show("Staff member updated successfully", "success");
        router.push("/staff");
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
          {/* Basic Information */}
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

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface-variant px-1">
              Role *
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger fullWidth>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="px-4 text-[12px] leading-4 text-error">{errors.role}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <Divider className="my-2" />

          {/* Personal Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              leadingIcon="cake"
              error={errors.dateOfBirth}
              fullWidth
            />
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Gender
              </label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="px-4 text-[12px] leading-4 text-error">{errors.gender}</p>
              )}
            </div>
          </div>

          <TextField
            label="Qualification"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            leadingIcon="school"
            error={errors.qualification}
            fullWidth
          />

          <TextField
            label="Join Date"
            type="date"
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
            leadingIcon="event"
            error={errors.joinDate}
            fullWidth
          />

          {isSuperAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Branch *
              </label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder={branchesLoading ? "Loading..." : "Select a branch"} />
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
          )}

          {mode === "edit" && (
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant px-1">
                Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger fullWidth>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/staff")}
        >
          Cancel
        </Button>
        <Button type="submit" variant="filled" loading={loading} icon="save">
          {mode === "create" ? "Create Staff Member" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
