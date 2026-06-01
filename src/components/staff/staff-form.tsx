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

  const isSuperAdmin = session?.user?.roleName === "SCHOOL_ADMIN" || session?.user?.roleName === "SUPER_ADMIN";

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
          snackbar.show(data.error?.message ?? "Failed to create staff member");
          return;
        }

        snackbar.show("Staff member created successfully");
        router.push("/staff");
        router.refresh();
      } catch {
        snackbar.show("An error occurred");
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
          snackbar.show(data.error?.message ?? "Failed to update staff member");
          return;
        }

        snackbar.show("Staff member updated successfully");
        router.push("/staff");
        router.refresh();
      } catch {
        snackbar.show("An error occurred");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Description */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-6">
            <h2 className="text-headline-sm font-semibold text-on-surface tracking-tight">
              {mode === "create" ? "Add New Staff" : "Edit Staff Profile"}
            </h2>
            <p className="text-body-md text-on-surface-variant mt-2 leading-relaxed">
              Enter the professional and personal details of the staff member. This information is used for their system access and school records.
            </p>
            
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/30 mt-8 hidden lg:block shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[22px]">lightbulb</span>
                <h3 className="text-title-sm font-medium text-on-surface">Quick Tips</h3>
              </div>
              <ul className="text-body-sm text-on-surface-variant space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 text-on-surface-variant/70">check_circle</span>
                  <span><strong>Role</strong> defines their system access and dashboard views.</span>
                </li>
                {isSuperAdmin && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] mt-0.5 text-on-surface-variant/70">check_circle</span>
                    <span><strong>Branch</strong> strictly limits their data access to that specific location.</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 text-on-surface-variant/70">check_circle</span>
                  <span><strong>Email</strong> is required if they need to login to the system.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Form Fields */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section: Identity Information */}
          <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl">
            <div className="bg-surface-container-lowest/50 px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-title-md font-medium text-on-surface flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                </div>
                Identity Information
              </h3>
            </div>
            <CardContent className="p-6 space-y-5">
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
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leadingIcon="mail"
                  error={errors.email}
                  fullWidth
                  autoComplete="email"
                  helperText="Required for system login"
                />
                <TextField
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leadingIcon="phone"
                  error={errors.phone}
                  fullWidth
                  autoComplete="tel"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section: Professional Details */}
          <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl">
            <div className="bg-surface-container-lowest/50 px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-title-md font-medium text-on-surface flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">work</span>
                </div>
                Professional Details
              </h3>
            </div>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md text-on-surface-variant font-medium px-1">
                    Role <span className="text-error">*</span>
                  </label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
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
                    <p className="px-3 mt-1 text-[12px] text-error">{errors.role}</p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant font-medium px-1">
                      Branch <span className="text-error">*</span>
                    </label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
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
                      <p className="px-3 mt-1 text-[12px] text-error">{errors.branchId}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label="Join Date"
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  leadingIcon="event"
                  error={errors.joinDate}
                  fullWidth
                />
                {mode === "edit" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant font-medium px-1">
                      Status
                    </label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
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
              </div>
            </CardContent>
          </Card>

          {/* Section: Personal Details */}
          <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl">
            <div className="bg-surface-container-lowest/50 px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-title-md font-medium text-on-surface flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">account_circle</span>
                </div>
                Personal Details
              </h3>
            </div>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label="Date of Birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  leadingIcon="cake"
                  error={errors.dateOfBirth}
                  fullWidth
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md text-on-surface-variant font-medium px-1">
                    Gender
                  </label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
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
                    <p className="px-3 mt-1 text-[12px] text-error">{errors.gender}</p>
                  )}
                </div>
              </div>
              <TextField
                label="Qualification / Degrees"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                leadingIcon="school"
                error={errors.qualification}
                fullWidth
                placeholder="e.g. M.Sc, B.Ed"
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 pb-12">
            <Button
              type="button"
              variant="text"
              onClick={() => router.push("/staff")}
              className="text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="filled" 
              loading={loading} 
              icon="save"
              className="px-8 shadow-sm"
            >
              {mode === "create" ? "Create Staff Profile" : "Save Changes"}
            </Button>
          </div>

        </div>
      </div>
    </form>
  );
}
