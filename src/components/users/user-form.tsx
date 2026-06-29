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
import { useAllPermissions } from "@/hooks/use-all-permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

const MODULE_ICONS: Record<string, string> = {
  students: "school",
  staff: "badge",
  attendance: "fact_check",
  fees: "payments",
  exams: "quiz",
  timetable: "calendar_month",
  transport: "directions_bus",
  library: "local_library",
  hostel: "apartment",
  notices: "campaign",
  events: "event",
  reports: "analytics",
  settings: "settings",
  subjects: "menu_book",
  classes: "class",
  academic_years: "date_range",
  branches: "location_city",
  users: "group",
  admissions: "assignment_ind",
};
interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string };
  isActive: boolean;
  branch: { id: string; name: string } | null;
  permissions?: { permissionId: string; granted: boolean }[];
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
  const { roles, loading: rolesLoading } = useRoles({ type: "STAFF" });

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

  const { data: session } = useSession();
  const { permissions: allPermissions, loading: permsLoading } = useAllPermissions();

  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (initialData?.permissions) {
      initialData.permissions.forEach(p => {
        map[p.permissionId] = p.granted;
      });
    }
    return map;
  });

  const rolePermissionIds = new Set<string>();
  if (roleId && roles.length > 0) {
    const selectedRole = roles.find(r => r.id === roleId);
    const rp = (selectedRole as any)?.rolePermissions;
    if (rp) {
      rp.forEach((p: any) => rolePermissionIds.add(p.permissionId));
    }
  }

  const isTargetSuperAdmin = roles.find(r => r.id === roleId)?.name === "SUPER_ADMIN";

  const handleTogglePermission = (permId: string, currentState: boolean) => {
    setCustomPermissions(prev => ({
      ...prev,
      [permId]: !currentState
    }));
  };

  const handleToggleRow = (moduleName: string, modulePerms: typeof allPermissions) => {
    const activeStates = modulePerms.map(p => {
      const roleHasIt = rolePermissionIds.has(p.id);
      return customPermissions[p.id] !== undefined ? customPermissions[p.id] : roleHasIt;
    });
    const allChecked = activeStates.length > 0 && activeStates.every(Boolean);
    
    const newState = !allChecked;
    setCustomPermissions(prev => {
      const next = { ...prev };
      modulePerms.forEach(p => {
        next[p.id] = newState;
      });
      return next;
    });
  };

  const permissionsByModule: Record<string, typeof allPermissions> = {};
  allPermissions.forEach(p => {
    if (!permissionsByModule[p.module]) {
      permissionsByModule[p.module] = [];
    }
    permissionsByModule[p.module].push(p);
  });
  const groupedPermissions = Object.entries(permissionsByModule);

  function generateRandomPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
    snackbar.show("Secure password generated", "success");
  }

  function copyToClipboard() {
    const text = `Email: ${email}\nPassword: ${password}`;
    navigator.clipboard.writeText(text);
    snackbar.show("Credentials copied to clipboard", "success");
  }

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
        customPermissions: Object.entries(customPermissions).map(([permissionId, granted]) => ({
          permissionId,
          granted
        }))
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
        password: password || undefined,
        customPermissions: Object.entries(customPermissions).map(([permissionId, granted]) => ({
          permissionId,
          granted
        }))
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
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
            <div className="space-y-6">
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

              <div className="border-t border-outline-variant/60 my-4"></div>

              {/* Password Reset for Existing User */}
              <div className="space-y-4">
                <h3 className="text-body-md font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">vpn_key</span>
                  Reset User Password
                </h3>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  Reset the password for this user. The user will be required to change this password on their next login for security reasons.
                </p>

                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <TextField
                        label="New Password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        leadingIcon="lock"
                        trailingIcon={showPassword ? "visibility_off" : "visibility"}
                        onTrailingIconClick={() => setShowPassword(!showPassword)}
                        error={errors.password}
                        fullWidth
                        autoComplete="new-password"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outlined"
                      icon="autorenew"
                      className="mt-1"
                      onClick={generateRandomPassword}
                    >
                      Generate
                    </Button>
                  </div>

                  {password && (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="text"
                        icon="content_copy"
                        onClick={copyToClipboard}
                      >
                        Copy Credentials
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        icon="clear"
                        className="text-error"
                        onClick={() => setPassword("")}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card variant="outlined" className="mt-6 overflow-hidden">
        <CardContent className="p-0 sm:p-6">
          <div className="border-b sm:border-none border-outline-variant/60 p-4 sm:p-0 mb-0 sm:mb-6">
            <h3 className="text-title-medium text-on-surface flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary">security</span>
              User Permissions
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Custom permissions override the default role permissions for this specific user.
            </p>
          </div>

          {isTargetSuperAdmin ? (
            <div className="m-4 sm:m-0 p-4 bg-amber-500/10 dark:bg-amber-500/5 rounded-lg border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 font-medium">
              Permissions management is disabled for SUPER_ADMIN role. Super Admins bypass all permission checks.
            </div>
          ) : permsLoading ? (
            <div className="flex justify-center p-8 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Loading permissions grid...
            </div>
          ) : allPermissions.length > 0 ? (
            <div className="space-y-6 sm:px-0">
              <div className="border-y sm:border border-slate-200 dark:border-zinc-800 sm:rounded-xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
                        <th className="font-semibold text-slate-700 dark:text-zinc-300 py-4 px-6 min-w-[200px]">Module</th>
                        {["Read", "Create", "Update", "Delete", "Manage"].map(action => (
                          <th key={action} className="font-semibold text-slate-500 dark:text-zinc-400 py-4 px-4 text-center w-[90px]">
                            {action}
                          </th>
                        ))}
                        <th className="font-semibold text-slate-500 dark:text-zinc-400 py-4 px-4 text-center w-[90px] border-l border-slate-200 dark:border-zinc-800">
                          All
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                      {groupedPermissions.map(([moduleName, perms]) => {
                        const hasRead = perms.find(p => p.action === "read");
                        const hasCreate = perms.find(p => p.action === "create");
                        const hasUpdate = perms.find(p => p.action === "update");
                        const hasDelete = perms.find(p => p.action === "delete");
                        const hasManage = perms.find(p => p.action === "manage");

                        return (
                          <tr key={moduleName} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-[18px]">
                                    {MODULE_ICONS[moduleName.toLowerCase()] || "folder"}
                                  </span>
                                </div>
                                <span className="font-medium text-slate-700 dark:text-zinc-300 capitalize">
                                  {moduleName.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </td>

                            {/* Permission Checkboxes */}
                            {[hasRead, hasCreate, hasUpdate, hasDelete, hasManage].map((perm, idx) => {
                              if (!perm) {
                                return <td key={idx} className="py-4 px-4 text-center"><span className="text-slate-300 dark:text-zinc-700">-</span></td>;
                              }
                              
                              const roleHasIt = rolePermissionIds.has(perm.id);
                              const isCustom = customPermissions[perm.id] !== undefined;
                              const isGranted = isCustom ? customPermissions[perm.id] : roleHasIt;

                              return (
                                <td key={perm.id} className="py-4 px-4 text-center">
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={isGranted}
                                      onChange={() => handleTogglePermission(perm.id, isGranted)}
                                      className={cn(
                                        "transition-all duration-200 rounded-[4px] border w-4 h-4",
                                        isGranted ? (isCustom ? "border-amber-500 bg-amber-500 text-white" : "border-primary bg-primary text-on-primary") : (isCustom ? "border-amber-500 border-dashed bg-transparent" : "border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600")
                                      )}
                                    />
                                  </div>
                                </td>
                              );
                            })}

                            {/* Row Toggle All */}
                            <td className="py-4 px-4 text-center border-l border-slate-100 dark:border-zinc-800/60 bg-slate-50/30 dark:bg-zinc-900/10">
                              <div className="flex justify-center">
                                {(() => {
                                  const activeStates = perms.map(p => {
                                    const roleHasIt = rolePermissionIds.has(p.id);
                                    return customPermissions[p.id] !== undefined ? customPermissions[p.id] : roleHasIt;
                                  });
                                  const allChecked = activeStates.length > 0 && activeStates.every(Boolean);
                                  const someChecked = activeStates.some(Boolean);
                                  const isIndeterminate = someChecked && !allChecked;
                                  
                                  return (
                                    <Checkbox
                                      checked={allChecked}
                                      ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                                      onChange={() => handleToggleRow(moduleName, perms)}
                                      className={cn(
                                        "transition-all duration-200 rounded-[4px] border w-4 h-4",
                                        allChecked || isIndeterminate ? "border-primary bg-primary text-on-primary" : "border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600"
                                      )}
                                    />
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aesthetic Legend */}
              <div className="m-4 sm:m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-200/40 dark:border-zinc-850">
                <span className="font-bold uppercase tracking-wider text-[9px] text-slate-400">Legend:</span>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-[3px] bg-primary flex items-center justify-center text-[8px] text-white">✓</div>
                  <span>Inherited Grant</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-[3px] border border-slate-300 dark:border-zinc-800 bg-transparent" />
                  <span>Inherited Deny</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-[3px] bg-amber-500 flex items-center justify-center text-[8px] text-white relative">
                    ✓
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Custom Grant</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-[3px] border border-dashed border-amber-500 bg-transparent relative">
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Custom Revoke</span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 pb-12">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/users")}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="filled" 
          loading={loading} 
          icon={mode === "create" ? "add" : "check"}
          className="w-full sm:w-auto sm:ml-auto px-8 shadow-md shadow-primary/20"
        >
          {mode === "create" ? "Create User" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
